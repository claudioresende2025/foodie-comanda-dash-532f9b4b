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

// Helper para enviar e-mail via Resend
async function sendEmailNotification(
  type: string, 
  to: string, 
  data: Record<string, any>
) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !anonKey) {
      logStep("E-mail: variáveis não configuradas");
      return;
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ type, to, data }),
    });
    
    if (response.ok) {
      logStep("E-mail enviado com sucesso", { type, to });
    } else {
      const error = await response.text();
      logStep("Falha ao enviar e-mail", { type, to, error });
    }
  } catch (e: any) {
    logStep("Erro ao enviar e-mail (não fatal)", { error: e.message });
  }
}

// Função para verificar assinatura do webhook
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const parts = sigHeader.split(",").reduce((acc, part) => {
      const [key, value] = part.split("=");
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const { t, v1 } = parts;
    if (!t || !v1) {
      logStep("Assinatura: t ou v1 ausente", { t: !!t, v1: !!v1 });
      return false;
    }

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

    const isValid = signatureHex === v1;
    logStep("Verificação de assinatura", { isValid, computed: signatureHex.substring(0, 20) + "...", expected: v1.substring(0, 20) + "..." });
    return isValid;
  } catch (error: any) {
    logStep("Erro na verificação de assinatura", { error: error.message });
    return false;
  }
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
  logStep("=== WEBHOOK INICIADO ===");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Obter variáveis de ambiente
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  logStep("Variáveis de ambiente", { 
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    hasStripeKey: !!stripeSecretKey,
    hasWebhookSecret: !!stripeWebhookSecret,
    supabaseUrlPrefix: supabaseUrl?.substring(0, 30)
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    logStep("ERRO: Variáveis Supabase não configuradas");
    return new Response(JSON.stringify({ error: "Supabase not configured" }), { status: 500 });
  }

  if (!stripeSecretKey) {
    logStep("ERRO: STRIPE_SECRET_KEY não configurada");
    return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    logStep("Request recebido", { 
      bodyLength: body.length, 
      hasSignature: !!signature,
      signaturePrefix: signature?.substring(0, 50)
    });

    let event;

    // Verificar assinatura se configurada
    if (stripeWebhookSecret && signature) {
      const isValid = await verifyStripeSignature(body, signature, stripeWebhookSecret);
      if (!isValid) {
        logStep("ERRO: Assinatura inválida");
        
        // Tentar salvar log mesmo com assinatura inválida
        try {
          await supabase.from('webhook_logs').insert({ 
            event: 'invalid_signature', 
            payload: { raw: body.substring(0, 500), signature: signature?.substring(0, 100) },
            status: 'error',
            error_message: 'Invalid webhook signature'
          });
          logStep("Log de erro salvo");
        } catch (logError: any) {
          logStep("Erro ao salvar log", { error: logError.message });
        }
        
        return new Response(JSON.stringify({ error: "Invalid signature" }), { 
          status: 400,
          headers: corsHeaders 
        });
      }
      logStep("Assinatura válida");
    } else {
      logStep("AVISO: Webhook secret não configurado ou signature ausente - processando sem verificação");
    }

    event = JSON.parse(body);
    logStep("Evento parseado", { type: event.type, id: event.id });

    // Log inicial do evento
    const { error: logError } = await supabase.from('webhook_logs').insert({
      event: event.type,
      referencia: event.id,
      payload: event.data?.object || {},
      status: 'received'
    });

    if (logError) {
      logStep("ERRO ao salvar log inicial", { error: logError.message, code: logError.code });
    } else {
      logStep("Log inicial salvo com sucesso");
    }

    // Processar cada tipo de evento
    let processResult = { success: true, message: '' };
    
    switch (event.type) {
      case 'checkout.session.completed': {
        processResult = await handleCheckoutCompleted(event.data.object, supabase, stripeSecretKey);
        break;
      }

      case 'invoice.payment_succeeded': {
        processResult = await handlePaymentSucceeded(event.data.object, supabase, stripeSecretKey);
        break;
      }

      case 'invoice.payment_failed': {
        processResult = await handlePaymentFailed(event.data.object, supabase);
        break;
      }

      case 'customer.subscription.updated': {
        processResult = await handleSubscriptionUpdated(event.data.object, supabase, stripeSecretKey);
        break;
      }

      case 'customer.subscription.deleted': {
        processResult = await handleSubscriptionDeleted(event.data.object, supabase);
        break;
      }

      default:
        logStep("Evento não tratado", { type: event.type });
        processResult = { success: true, message: `Evento ${event.type} não requer processamento` };
    }

    // Atualizar log com resultado
    await supabase.from('webhook_logs').update({
      status: processResult.success ? 'processed' : 'error',
      error_message: processResult.success ? null : processResult.message
    }).eq('referencia', event.id);

    logStep("=== WEBHOOK FINALIZADO ===", processResult);

    return new Response(JSON.stringify({ received: true, ...processResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("ERRO CRÍTICO", { message: error.message, stack: error.stack?.substring(0, 200) });
    
    try {
      await supabase.from('webhook_logs').insert({
        event: 'critical_error',
        payload: { error: error.message },
        status: 'error',
        error_message: error.message
      });
    } catch (logErr) {
      logStep("Não foi possível salvar log de erro crítico");
    }

    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: corsHeaders 
    });
  }
});

// Handler: checkout.session.completed
async function handleCheckoutCompleted(session: any, supabase: any, stripeKey: string): Promise<{ success: boolean; message: string }> {
  logStep(">>> handleCheckoutCompleted", { sessionId: session.id });

  const metadata = session.metadata || {};
  const empresaId = metadata.empresa_id;
  const planoId = metadata.plano_id;
  const periodo = metadata.periodo || 'mensal';
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  logStep("Metadata extraído", { empresaId, planoId, periodo, subscriptionId, customerId });

  if (!empresaId) {
    logStep("AVISO: empresa_id não encontrado no metadata - checkout pode ser de novo usuário");
    return { success: true, message: "empresa_id ausente - aguardando registro" };
  }

  // Buscar detalhes da subscription do Stripe
  let subscription = null;
  if (subscriptionId) {
    subscription = await stripeRequest(`/subscriptions/${subscriptionId}`, stripeKey);
    logStep("Subscription do Stripe", { id: subscription.id, status: subscription.status });
  }

  // Determinar plano_id
  let finalPlanoId = planoId;
  if (!finalPlanoId && subscription) {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    if (priceId) {
      const { data: plano, error } = await supabase
        .from('planos')
        .select('id')
        .or(`stripe_price_id_mensal.eq.${priceId},stripe_price_id_anual.eq.${priceId}`)
        .single();
      
      if (plano) {
        finalPlanoId = plano.id;
        logStep("Plano encontrado pelo price_id", { planoId: finalPlanoId });
      } else if (error) {
        logStep("Erro ao buscar plano por price_id", { error: error.message });
      }
    }
  }

  // Fallback para primeiro plano ativo
  if (!finalPlanoId) {
    const { data: defaultPlano, error } = await supabase
      .from('planos')
      .select('id')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .limit(1)
      .single();
    
    if (defaultPlano) {
      finalPlanoId = defaultPlano.id;
      logStep("Usando plano padrão", { planoId: finalPlanoId });
    } else if (error) {
      logStep("Erro ao buscar plano padrão", { error: error.message });
      return { success: false, message: "Nenhum plano encontrado" };
    }
  }

  if (!finalPlanoId) {
    return { success: false, message: "Nenhum plano disponível" };
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
  const assinaturaData = {
    empresa_id: empresaId,
    plano_id: finalPlanoId,
    status: 'active',
    periodo: periodo,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    data_inicio: dataInicio,
    data_fim: dataFim.toISOString(),
    updated_at: new Date().toISOString()
  };

  logStep("Salvando assinatura", assinaturaData);

  const { data: assinatura, error: assinaturaError } = await supabase
    .from('assinaturas')
    .upsert(assinaturaData, { onConflict: 'empresa_id' })
    .select()
    .single();

  if (assinaturaError) {
    logStep("ERRO ao salvar assinatura", { error: assinaturaError.message, code: assinaturaError.code });
    return { success: false, message: `Erro assinatura: ${assinaturaError.message}` };
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
  const pagamentoData = {
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
  };

  logStep("Registrando pagamento", pagamentoData);

  const { error: pagamentoError } = await supabase
    .from('pagamentos_assinatura')
    .insert(pagamentoData);

  if (pagamentoError) {
    logStep("ERRO ao registrar pagamento", { error: pagamentoError.message, code: pagamentoError.code });
    return { success: false, message: `Erro pagamento: ${pagamentoError.message}` };
  }
  
  logStep("Pagamento registrado com sucesso");

  // Enviar e-mail de confirmação de assinatura
  const customerEmail = session.customer_details?.email || session.customer_email;
  const customerName = session.customer_details?.name || 'Cliente';
  
  if (customerEmail) {
    await sendEmailNotification('subscription_confirmed', customerEmail, {
      nome: customerName,
      plano: planoInfo?.nome || 'Plano',
      valor: `R$ ${valorPagamento.toFixed(2)}`,
      proximaCobranca: dataFim.toLocaleDateString('pt-BR'),
      dashboardUrl: 'https://foodie-comanda-dash.lovable.app/admin'
    });
  }

  return { success: true, message: "Checkout processado com sucesso" };
}

// Handler: invoice.payment_succeeded
async function handlePaymentSucceeded(invoice: any, supabase: any, stripeKey: string): Promise<{ success: boolean; message: string }> {
  logStep(">>> handlePaymentSucceeded", { invoiceId: invoice.id });

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    logStep("Sem subscription_id no invoice");
    return { success: true, message: "Invoice sem subscription" };
  }

  // Buscar assinatura pelo stripe_subscription_id
  const { data: assinatura, error } = await supabase
    .from('assinaturas')
    .select('*, planos(nome)')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (error || !assinatura) {
    logStep("Assinatura não encontrada", { subscriptionId, error: error?.message });
    return { success: true, message: "Assinatura não encontrada - pode ser novo checkout" };
  }

  // Atualizar data_fim baseado no período atual
  const subscription = await stripeRequest(`/subscriptions/${subscriptionId}`, stripeKey);
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  const { error: updateError } = await supabase
    .from('assinaturas')
    .update({
      status: 'active',
      data_fim: periodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('id', assinatura.id);

  if (updateError) {
    logStep("Erro ao atualizar assinatura", { error: updateError.message });
  } else {
    logStep("Assinatura atualizada", { dataFim: periodEnd });
  }

  // Registrar pagamento (evitar duplicatas verificando payment_intent)
  const paymentIntent = invoice.payment_intent;
  
  const { data: existingPayment } = await supabase
    .from('pagamentos_assinatura')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent)
    .maybeSingle();

  if (!existingPayment && paymentIntent) {
    const { error: insertError } = await supabase
      .from('pagamentos_assinatura')
      .insert({
        empresa_id: assinatura.empresa_id,
        assinatura_id: assinatura.id,
        valor: invoice.amount_paid / 100,
        status: 'succeeded',
        metodo_pagamento: 'stripe',
        descricao: `Renovação - ${assinatura.planos?.nome || 'Plano'}`,
        stripe_payment_intent_id: paymentIntent,
        metadata: {
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: subscriptionId
        }
      });

    if (insertError) {
      logStep("Erro ao registrar pagamento", { error: insertError.message });
      return { success: false, message: insertError.message };
    }
    logStep("Pagamento de renovação registrado");

    // Enviar recibo por e-mail
    const customerEmail = invoice.customer_email;
    if (customerEmail) {
      await sendEmailNotification('payment_receipt', customerEmail, {
        nome: invoice.customer_name || 'Cliente',
        descricao: `Renovação - ${assinatura.planos?.nome || 'Plano'}`,
        valor: `R$ ${(invoice.amount_paid / 100).toFixed(2)}`,
        data: new Date().toLocaleDateString('pt-BR'),
        metodo: 'Cartão de Crédito'
      });
    }
  } else {
    logStep("Pagamento já registrado ou sem payment_intent");
  }

  return { success: true, message: "Pagamento processado" };
}

// Handler: invoice.payment_failed
async function handlePaymentFailed(invoice: any, supabase: any): Promise<{ success: boolean; message: string }> {
  logStep(">>> handlePaymentFailed", { invoiceId: invoice.id });

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    return { success: true, message: "Invoice sem subscription" };
  }

  const { data: assinatura } = await supabase
    .from('assinaturas')
    .select('id, empresa_id, planos(nome)')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!assinatura) {
    logStep("Assinatura não encontrada para falha de pagamento");
    return { success: true, message: "Assinatura não encontrada" };
  }

  await supabase
    .from('assinaturas')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('id', assinatura.id);

  logStep("Status atualizado para past_due");

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

  // Enviar e-mail de aviso sobre falha no pagamento
  const customerEmail = invoice.customer_email;
  if (customerEmail) {
    await sendEmailNotification('trial_reminder', customerEmail, {
      nome: invoice.customer_name || 'Cliente',
      plano: assinatura.planos?.nome || 'Plano',
      diasRestantes: 0,
      checkoutUrl: 'https://foodie-comanda-dash.lovable.app/planos'
    });
  }

  logStep("Falha de pagamento registrada");
  return { success: true, message: "Falha registrada" };
}

// Handler: customer.subscription.updated
async function handleSubscriptionUpdated(subscription: any, supabase: any, stripeKey: string): Promise<{ success: boolean; message: string }> {
  logStep(">>> handleSubscriptionUpdated", { subscriptionId: subscription.id });

  const { data: assinatura } = await supabase
    .from('assinaturas')
    .select('id, empresa_id, plano_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!assinatura) {
    logStep("Assinatura não encontrada para atualização");
    return { success: true, message: "Assinatura não encontrada" };
  }

  const priceId = subscription.items?.data?.[0]?.price?.id;
  let novoPlanoId = assinatura.plano_id;
  let planoMudou = false;

  if (priceId) {
    const { data: plano } = await supabase
      .from('planos')
      .select('id, nome')
      .or(`stripe_price_id_mensal.eq.${priceId},stripe_price_id_anual.eq.${priceId}`)
      .single();

    if (plano && plano.id !== assinatura.plano_id) {
      novoPlanoId = plano.id;
      planoMudou = true;
      logStep("Mudança de plano detectada", { de: assinatura.plano_id, para: novoPlanoId });

      // Enviar e-mail de confirmação de mudança de plano
      const customer = await stripeRequest(`/customers/${subscription.customer}`, stripeKey);
      if (customer?.email) {
        await sendEmailNotification('subscription_confirmed', customer.email, {
          nome: customer.name || 'Cliente',
          plano: plano.nome,
          valor: 'Conforme plano escolhido',
          proximaCobranca: new Date(subscription.current_period_end * 1000).toLocaleDateString('pt-BR'),
          dashboardUrl: 'https://foodie-comanda-dash.lovable.app/admin'
        });
      }
    }
  }

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

  await supabase
    .from('assinaturas')
    .update({
      plano_id: novoPlanoId,
      status: novoStatus,
      data_fim: periodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('id', assinatura.id);

  logStep("Assinatura atualizada", { status: novoStatus, planoId: novoPlanoId, planoMudou });
  return { success: true, message: "Subscription atualizada" };
}

// Handler: customer.subscription.deleted
async function handleSubscriptionDeleted(subscription: any, supabase: any): Promise<{ success: boolean; message: string }> {
  logStep(">>> handleSubscriptionDeleted", { subscriptionId: subscription.id });

  const { data: assinatura } = await supabase
    .from('assinaturas')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!assinatura) {
    logStep("Assinatura não encontrada para cancelamento");
    return { success: true, message: "Assinatura não encontrada" };
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
  return { success: true, message: "Subscription cancelada" };
}
