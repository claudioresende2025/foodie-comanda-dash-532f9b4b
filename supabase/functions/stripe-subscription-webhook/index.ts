import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Helper para logs detalhados
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Função para verificar assinatura do webhook
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const { t, v1 } = parts;
  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return signatureHex === v1;
}

// Helper para fazer requisições à API do Stripe
async function stripeRequest(endpoint: string, stripeKey: string, method = "GET", body?: any) {
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  
  if (body && method !== "GET") {
    options.body = new URLSearchParams(body).toString();
  }
  
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, options);
  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event;

    // Verificar assinatura se configurada
    if (stripeWebhookSecret && signature) {
      const isValid = await verifyStripeSignature(body, signature, stripeWebhookSecret);
      if (!isValid) {
        logStep("Assinatura inválida");
        await supabase.from('webhook_logs').insert({ 
          event: 'invalid_signature', 
          payload: { raw: body.substring(0, 500) },
          status: 'error',
          error_message: 'Invalid webhook signature'
        });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
    }

    event = JSON.parse(body);
    logStep("Evento recebido", { type: event.type, id: event.id });

    // Processar cada tipo de evento
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object, supabase, stripeSecretKey);
        break;
      }

      case 'invoice.payment_succeeded': {
        await handlePaymentSucceeded(event.data.object, supabase, stripeSecretKey);
        break;
      }

      case 'invoice.payment_failed': {
        await handlePaymentFailed(event.data.object, supabase);
        break;
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object, supabase, stripeSecretKey);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object, supabase);
        break;
      }

      default:
        logStep("Evento não tratado", { type: event.type });
    }

    // Log do evento processado
    await supabase.from('webhook_logs').insert({
      event: event.type,
      referencia: event.id,
      payload: event.data.object,
      status: 'processed'
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Erro crítico", { message: error.message });
    
    await supabase.from('webhook_logs').insert({
      event: 'error',
      payload: { error: error.message },
      status: 'error',
      error_message: error.message
    });

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

// Handler: checkout.session.completed
async function handleCheckoutCompleted(session: any, supabase: any, stripeKey: string) {
  logStep("Processando checkout.session.completed", { sessionId: session.id });

  const metadata = session.metadata || {};
  const empresaId = metadata.empresa_id;
  const planoId = metadata.plano_id;
  const periodo = metadata.periodo || 'mensal';
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  if (!empresaId) {
    logStep("empresa_id não encontrado no metadata");
    return;
  }

  // Buscar detalhes da subscription do Stripe
  let subscription = null;
  if (subscriptionId) {
    subscription = await stripeRequest(`/subscriptions/${subscriptionId}`, stripeKey);
    logStep("Subscription obtida", { id: subscription.id, status: subscription.status });
  }

  // Determinar plano_id
  let finalPlanoId = planoId;
  if (!finalPlanoId && subscription) {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    if (priceId) {
      const { data: plano } = await supabase
        .from('planos')
        .select('id')
        .or(`stripe_price_id_mensal.eq.${priceId},stripe_price_id_anual.eq.${priceId}`)
        .single();
      
      if (plano) {
        finalPlanoId = plano.id;
        logStep("Plano encontrado pelo price_id", { planoId: finalPlanoId });
      }
    }
  }

  // Fallback para primeiro plano ativo
  if (!finalPlanoId) {
    const { data: defaultPlano } = await supabase
      .from('planos')
      .select('id')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .limit(1)
      .single();
    
    finalPlanoId = defaultPlano?.id;
    logStep("Usando plano padrão", { planoId: finalPlanoId });
  }

  if (!finalPlanoId) {
    logStep("Nenhum plano encontrado");
    return;
  }

  // Calcular datas
  const dataInicio = new Date().toISOString();
  let dataFim = new Date();
  if (periodo === 'anual') {
    dataFim.setFullYear(dataFim.getFullYear() + 1);
  } else {
    dataFim.setMonth(dataFim.getMonth() + 1);
  }

  // Upsert assinatura
  const { data: assinatura, error: assinaturaError } = await supabase
    .from('assinaturas')
    .upsert({
      empresa_id: empresaId,
      plano_id: finalPlanoId,
      status: 'active',
      periodo: periodo,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      data_inicio: dataInicio,
      data_fim: dataFim.toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'empresa_id' })
    .select()
    .single();

  if (assinaturaError) {
    logStep("Erro ao salvar assinatura", { error: assinaturaError.message });
    return;
  }

  logStep("Assinatura salva", { id: assinatura.id, planoId: finalPlanoId });

  // Buscar valor do plano
  const { data: planoInfo } = await supabase
    .from('planos')
    .select('nome, preco_mensal, preco_anual')
    .eq('id', finalPlanoId)
    .single();

  const valorPagamento = periodo === 'anual' 
    ? (planoInfo?.preco_anual || 0) 
    : (planoInfo?.preco_mensal || 0);

  // Registrar pagamento
  const { error: pagamentoError } = await supabase
    .from('pagamentos_assinatura')
    .insert({
      empresa_id: empresaId,
      assinatura_id: assinatura.id,
      valor: valorPagamento,
      status: 'succeeded',
      metodo_pagamento: 'stripe',
      descricao: `Assinatura ${planoInfo?.nome || 'Plano'} - ${periodo}`,
      stripe_payment_intent_id: session.payment_intent,
      metadata: {
        stripe_session_id: session.id,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        plano_nome: planoInfo?.nome
      }
    });

  if (pagamentoError) {
    logStep("Erro ao registrar pagamento", { error: pagamentoError.message });
  } else {
    logStep("Pagamento registrado com sucesso");
  }
}

// Handler: invoice.payment_succeeded
async function handlePaymentSucceeded(invoice: any, supabase: any, stripeKey: string) {
  logStep("Processando invoice.payment_succeeded", { invoiceId: invoice.id });

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    logStep("Sem subscription_id no invoice");
    return;
  }

  // Buscar assinatura pelo stripe_subscription_id
  const { data: assinatura, error } = await supabase
    .from('assinaturas')
    .select('*, planos(nome)')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (error || !assinatura) {
    logStep("Assinatura não encontrada", { subscriptionId });
    return;
  }

  // Atualizar data_fim baseado no período atual
  const subscription = await stripeRequest(`/subscriptions/${subscriptionId}`, stripeKey);
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  await supabase
    .from('assinaturas')
    .update({
      status: 'active',
      data_fim: periodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('id', assinatura.id);

  logStep("Assinatura atualizada", { dataFim: periodEnd });

  // Registrar pagamento (evitar duplicatas verificando payment_intent)
  const paymentIntent = invoice.payment_intent;
  
  const { data: existingPayment } = await supabase
    .from('pagamentos_assinatura')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent)
    .single();

  if (!existingPayment) {
    await supabase
      .from('pagamentos_assinatura')
      .insert({
        empresa_id: assinatura.empresa_id,
        assinatura_id: assinatura.id,
        valor: invoice.amount_paid / 100, // Stripe usa centavos
        status: 'succeeded',
        metodo_pagamento: 'stripe',
        descricao: `Renovação - ${assinatura.planos?.nome || 'Plano'}`,
        stripe_payment_intent_id: paymentIntent,
        metadata: {
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: subscriptionId
        }
      });

    logStep("Pagamento de renovação registrado");
  } else {
    logStep("Pagamento já registrado anteriormente");
  }
}

// Handler: invoice.payment_failed
async function handlePaymentFailed(invoice: any, supabase: any) {
  logStep("Processando invoice.payment_failed", { invoiceId: invoice.id });

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Buscar assinatura
  const { data: assinatura } = await supabase
    .from('assinaturas')
    .select('id, empresa_id, planos(nome)')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!assinatura) {
    logStep("Assinatura não encontrada para falha de pagamento");
    return;
  }

  // Atualizar status para past_due
  await supabase
    .from('assinaturas')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('id', assinatura.id);

  logStep("Status atualizado para past_due");

  // Registrar tentativa falha
  await supabase
    .from('pagamentos_assinatura')
    .insert({
      empresa_id: assinatura.empresa_id,
      assinatura_id: assinatura.id,
      valor: invoice.amount_due / 100,
      status: 'failed',
      metodo_pagamento: 'stripe',
      descricao: `Falha no pagamento - ${assinatura.planos?.nome || 'Plano'}`,
      stripe_payment_intent_id: invoice.payment_intent,
      metadata: {
        stripe_invoice_id: invoice.id,
        failure_message: invoice.last_finalization_error?.message
      }
    });

  logStep("Falha de pagamento registrada");
}

// Handler: customer.subscription.updated
async function handleSubscriptionUpdated(subscription: any, supabase: any, stripeKey: string) {
  logStep("Processando customer.subscription.updated", { subscriptionId: subscription.id });

  // Buscar assinatura existente
  const { data: assinatura } = await supabase
    .from('assinaturas')
    .select('id, empresa_id, plano_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!assinatura) {
    logStep("Assinatura não encontrada para atualização");
    return;
  }

  // Determinar novo plano pelo price_id
  const priceId = subscription.items?.data?.[0]?.price?.id;
  let novoPlanoId = assinatura.plano_id;

  if (priceId) {
    const { data: plano } = await supabase
      .from('planos')
      .select('id')
      .or(`stripe_price_id_mensal.eq.${priceId},stripe_price_id_anual.eq.${priceId}`)
      .single();

    if (plano && plano.id !== assinatura.plano_id) {
      novoPlanoId = plano.id;
      logStep("Mudança de plano detectada", { de: assinatura.plano_id, para: novoPlanoId });
    }
  }

  // Mapear status do Stripe
  const statusMap: Record<string, string> = {
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'past_due',
    'trialing': 'trialing',
    'incomplete': 'incomplete',
    'incomplete_expired': 'canceled'
  };

  const novoStatus = statusMap[subscription.status] || 'active';
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Atualizar assinatura
  await supabase
    .from('assinaturas')
    .update({
      plano_id: novoPlanoId,
      status: novoStatus,
      data_fim: periodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('id', assinatura.id);

  logStep("Assinatura atualizada", { status: novoStatus, planoId: novoPlanoId });
}

// Handler: customer.subscription.deleted
async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  logStep("Processando customer.subscription.deleted", { subscriptionId: subscription.id });

  // Buscar e atualizar assinatura
  const { data: assinatura } = await supabase
    .from('assinaturas')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!assinatura) {
    logStep("Assinatura não encontrada para cancelamento");
    return;
  }

  await supabase
    .from('assinaturas')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', assinatura.id);

  logStep("Assinatura cancelada com sucesso");
}
