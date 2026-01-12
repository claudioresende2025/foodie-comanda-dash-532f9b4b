import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não configurado");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripeSecret = stripeSecretKey;

    // Helper para chamadas REST simples ao Stripe
    const stripeRequest = async (path: string, method = 'GET') => {
      const url = `https://api.stripe.com/v1/${path}`;
      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          Accept: 'application/json'
        }
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      return resp.json();
    };

    // Função para verificar assinatura do webhook Stripe (HMAC SHA256)
    const verifyStripeSignature = async (payload: string, sigHeader: string | null, secret: string) => {
      if (!sigHeader) return false;
      // Header example: t=timestamp,v1=signature,v0=...
      const parts = sigHeader.split(',');
      let timestamp: string | null = null;
      const signatures: string[] = [];
      for (const p of parts) {
        const [k,v] = p.split('=');
        if (k === 't') timestamp = v;
        if (k === 'v1') signatures.push(v);
      }
      if (!timestamp) return false;
      const signed = `${timestamp}.${payload}`;
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signed));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
      for (const s of signatures) {
        if (hex === s) return true;
      }
      return false;
    };

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: any;
    // Verificar assinatura do webhook (se configurado)
      if (stripeWebhookSecret && signature) {
        const ok = await verifyStripeSignature(body, signature, stripeWebhookSecret);
        if (!ok) {
          console.error('Assinatura do webhook inválida');
          try {
            // Persistir o payload para depuração mesmo com assinatura inválida
            const parsed = (() => { try { return JSON.parse(body); } catch { return { raw: body }; } })();
            await supabase.from('webhook_logs').insert({ event: 'invalid_signature', referencia: null, empresa_id: null, payload: parsed });
          } catch (e) {
            console.error('Erro ao gravar webhook_logs para assinatura inválida:', e);
          }
          return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
        }
        event = JSON.parse(body);
    } else {
      // Sem verificação (desenvolvimento)
      event = JSON.parse(body);
    }

    console.log("Evento recebido:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        await handleCheckoutCompleted(supabase, stripeRequest, session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(supabase, stripeRequest, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as any;
        await handleChargeRefunded(supabase, charge);
        break;
      }

      default:
        console.log(`Evento não tratado: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro no webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Handler: Checkout concluído
async function handleCheckoutCompleted(supabase: any, stripeRequest: any, session: any) {
  const empresaId = session.metadata?.empresa_id;
  const planoId = session.metadata?.plano_id;
  const periodo = session.metadata?.periodo || 'mensal';

  console.log("[handleCheckoutCompleted] Metadata recebido:", { empresaId, planoId, periodo });
  console.log("[handleCheckoutCompleted] Session metadata completo:", session.metadata);
  console.log("[handleCheckoutCompleted] Subscription data metadata:", (session as any).subscription_data?.metadata);

  console.log('[DEBUG][handleCheckoutCompleted] session object:', JSON.stringify(session, null, 2));
  if (!empresaId) {
    console.error("empresa_id não encontrado no metadata - checkout de novo usuário?");
    // Para novos usuários, o plano será aplicado no Onboarding via localStorage
    return;
  }

  // Buscar subscription ID
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    console.error('subscription id não encontrado na sessão do checkout');
    return;
  }

  // Recuperar subscription do Stripe via REST
  const subscription = await (async () => {
    try {
      return await stripeRequest(`subscriptions/${subscriptionId}`);
    } catch (e) {
      console.error('Erro ao recuperar subscription via Stripe API:', e?.message || e);
      throw e;
    }
  })();
  // Logs adicionais para depuração
  try {
    console.log('[DEBUG][handleCheckoutCompleted] subscription.id:', subscription.id);
    console.log('[DEBUG][handleCheckoutCompleted] subscription.metadata:', JSON.stringify(subscription.metadata));
    console.log('[DEBUG][handleCheckoutCompleted] subscription.items:', JSON.stringify(subscription.items?.data || subscription.items));
  } catch (e) {
    console.warn('Erro ao logar subscription debug info:', e);
  }

  // Tentar gravar um log leve no banco para ajudar na depuração (não falha o fluxo)
  try {
    await supabase.from('webhook_logs').insert({
      event: 'checkout.session.completed',
      referencia: subscription.id,
      empresa_id: empresaId || null,
      payload: JSON.stringify({ session: session, subscription: subscription }),
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Não foi possível inserir webhook_logs (pode não existir a tabela):', e?.message || e);
  }

  try {
    await updateSubscriptionInDB(supabase, stripeRequest, empresaId, subscription, planoId);
  } catch (err: any) {
    console.error('Erro ao atualizar assinatura via updateSubscriptionInDB:', err);
  }

  console.log("Checkout concluído para empresa:", empresaId);
  // Enviar e-mail para o cliente (se disponível) com link para login/cadastro
  try {
    let email = session.customer_details?.email || (session.customer_email as string | undefined);

    if (!email && session.customer) {
      try {
        const customer = await stripeRequest(`customers/${session.customer}`);
        email = customer?.email;
      } catch (e) {
        console.warn('Erro ao recuperar customer via Stripe API:', e?.message || e);
      }
    }

    const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://" + (Deno.env.get("SUPABASE_PROJECT_REF") || "your-frontend.example");

    if (email) {
      const loginLink = `${frontendUrl.replace(/\/$/, '')}/auth?from=subscription&empresa=${encodeURIComponent(empresaId)}&plano=${encodeURIComponent(planoId ?? '')}`;

      // Registrar envio no banco
      try {
        await supabase.from('email_logs').insert({
          to: email,
          subject: 'Seu acesso à Foodie Comanda',
          template: 'subscription_welcome',
          metadata: { empresa_id: empresaId, plano_id: planoId },
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Não foi possível registrar email_logs:', e);
      }

      if (sendgridKey) {
        const body = {
          personalizations: [
            {
              to: [{ email }],
              subject: 'Ative seu acesso - Foodie Comanda',
            },
          ],
          from: { email: 'no-reply@foodiecomanda.com.br', name: 'Foodie Comanda' },
          content: [
            {
              type: 'text/html',
              value: `
                <p>Olá,</p>
                <p>Obrigado por assinar o plano. Para finalizar seu acesso, crie sua conta ou faça login:</p>
                <p><a href="${loginLink}">Acessar / Cadastrar</a></p>
                <p>Se precisar de ajuda, responda este e-mail.</p>
              `,
            },
          ],
        };

        try {
          await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${sendgridKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          console.log('E-mail de boas-vindas enviado para', email);
        } catch (err) {
          console.error('Erro ao enviar e-mail via SendGrid:', err);
        }
      } else {
        console.log('SENDGRID_API_KEY não configurada — e-mail não enviado automaticamente. Destinatário:', email, 'Link:', loginLink);
      }
    } else {
      console.log('Nenhum e-mail encontrado na sessão do checkout para empresa', empresaId);
    }
  } catch (err) {
    console.error('Erro no envio de e-mail após checkout:', err);
  }
}

// Handler: Assinatura atualizada
async function handleSubscriptionUpdated(supabase: any, stripeRequest: any, subscription: any) {
  const empresaId = subscription.metadata?.empresa_id;

  if (!empresaId) {
    // Tentar buscar por stripe_subscription_id
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("empresa_id")
      .eq("stripe_subscription_id", subscription.id)
      .single();

    if (!assinatura) {
      console.log("Assinatura não encontrada no banco");
      return;
    }

    await updateSubscriptionInDB(supabase, stripeRequest, assinatura.empresa_id, subscription);
  } else {
    await updateSubscriptionInDB(supabase, stripeRequest, empresaId, subscription);
  }
}

async function updateSubscriptionInDB(supabase: any, stripeRequest: any, empresaId: string, subscription: any, forcePlanoId?: string) {
  const status = mapStripeStatus(subscription.status);

  // Logs extras para depuração
  try {
    console.log('[DEBUG][updateSubscriptionInDB] subscription.id:', subscription.id);
    console.log('[DEBUG][updateSubscriptionInDB] forcePlanoId:', forcePlanoId);
    console.log('[DEBUG][updateSubscriptionInDB] subscription.metadata:', JSON.stringify(subscription.metadata));
    console.log('[DEBUG][updateSubscriptionInDB] subscription.items:', JSON.stringify(subscription.items?.data || subscription.items));
  } catch (e) {
    console.warn('Erro ao logar debug info em updateSubscriptionInDB:', e);
  }

  // 1. Tentar usar o plano forçado (vindo do checkout session)
  let planoId = forcePlanoId;

  // 2. Se não tem forçado, tentar buscar pelo price_id (fonte da verdade do faturamento)
  if (!planoId && subscription.items?.data?.length > 0) {
    const priceId = subscription.items.data[0].price?.id;
    if (priceId) {
      console.log("Buscando plano pelo price_id:", priceId);
      
      // Buscar plano pelo stripe_price_id (mensal ou anual)
      const { data: planoMensal } = await supabase
        .from("planos")
        .select("id")
        .eq("stripe_price_id_mensal", priceId)
        .maybeSingle();
      
      if (planoMensal?.id) {
        planoId = planoMensal.id;
        console.log("Plano encontrado via price_id mensal:", planoId);
      } else {
        // Tentar buscar por price_id anual
        const { data: planoAnual } = await supabase
          .from("planos")
          .select("id")
          .eq("stripe_price_id_anual", priceId)
          .maybeSingle();
        
        if (planoAnual?.id) {
          planoId = planoAnual.id;
          console.log("Plano encontrado via price_id anual:", planoId);
        }
      }
      
      // Se ainda não encontrou, tentar buscar pelo product metadata
      if (!planoId) {
        const productId = subscription.items.data[0].price?.product;
        if (productId && typeof productId === 'string') {
          // O product metadata pode ter o plano_id
          const { data: planoByProduct } = await supabase
            .from("planos")
            .select("id")
            .eq("stripe_product_id", productId)
            .maybeSingle();
          
          if (planoByProduct?.id) {
            planoId = planoByProduct.id;
            console.log("Plano encontrado via product_id:", planoId);
          }
        }
      }

      // NOVO: Se ainda não encontrou e temos priceId, buscar no Stripe e atualizar DB
      if (!planoId && priceId) {
        console.log("Plano não encontrado no DB. Buscando no Stripe para price_id:", priceId);
        try {
          const price = await stripeRequest(`prices/${priceId}`);
          if (price && price.product) {
            const productId = typeof price.product === 'string' ? price.product : price.product.id;
            const priceType = price.recurring?.interval === 'year' ? 'anual' : 'mensal';
            
            console.log(`Preço encontrado no Stripe: Product=${productId}, Type=${priceType}`);
            
            // 1. Tentar encontrar plano pelo product_id
            const { data: planoByProduct } = await supabase
              .from("planos")
              .select("id")
              .eq("stripe_product_id", productId)
              .maybeSingle();

            if (planoByProduct?.id) {
              console.log("Plano encontrado pelo stripe_product_id! Atualizando price_id faltante...");
              // Atualizar o price_id no plano
              const updateField = priceType === 'anual' 
                ? { stripe_price_id_anual: priceId }
                : { stripe_price_id_mensal: priceId };
              
              await supabase.from("planos").update(updateField).eq("id", planoByProduct.id);
              planoId = planoByProduct.id;
            } else {
              // 2. Tentar encontrar pelo metadata do produto/preço
              const metadataPlanoId = price.metadata?.plano_id || (await stripeRequest(`products/${productId}`)).metadata?.plano_id;
              if (metadataPlanoId) {
                 console.log("Plano encontrado via metadata do Stripe:", metadataPlanoId);
                 // Atualizar dados do plano
                 const updateField: any = { stripe_product_id: productId };
                 if (priceType === 'anual') updateField.stripe_price_id_anual = priceId;
                 else updateField.stripe_price_id_mensal = priceId;

                 await supabase.from("planos").update(updateField).eq("id", metadataPlanoId);
                 planoId = metadataPlanoId;
              }
            }
          }
        } catch (e) {
          console.error("Erro ao tentar recuperar/atualizar plano via Stripe:", e);
        }
      }
    }
  }

  // 3. Se ainda não tem plano, tentar metadata da subscription (pode estar desatualizado em upgrades)
  if (!planoId) {
    planoId = subscription.metadata?.plano_id;
    if (planoId) console.log("Plano obtido via subscription.metadata:", planoId);
  }

  const toISO = (timestamp: any) => {
    if (!timestamp || isNaN(Number(timestamp))) return null;
    return new Date(Number(timestamp) * 1000).toISOString();
  };

  const updateData: Record<string, any> = {
    empresa_id: empresaId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    status,
    current_period_start: toISO(subscription.current_period_start),
    current_period_end: toISO(subscription.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: toISO(subscription.canceled_at),
    updated_at: new Date().toISOString(),
  };

  // Atualizar plano_id se encontrado (upgrade/downgrade)
  if (planoId) {
    updateData.plano_id = planoId;
    console.log("Atualizando plano_id para:", planoId);
  }

  // Usar upsert para garantir que crie a assinatura se não existir
  const { error: upsertError } = await supabase
    .from("assinaturas")
    .upsert(updateData, { onConflict: 'empresa_id' });

  if (upsertError) {
    console.error("Erro ao fazer upsert da assinatura:", upsertError);
    throw upsertError;
  }

  // Tentar gravar um log leve no banco para depuração (não obrigatório)
  try {
    await supabase.from('webhook_logs').insert({
      event: 'subscription.updated',
      referencia: subscription.id,
      empresa_id: empresaId || null,
      payload: JSON.stringify({ subscription }),
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Não foi possível inserir webhook_logs em updateSubscriptionInDB:', e?.message || e);
  }

  // Atualizar empresa
  await supabase
    .from("empresas")
    .update({
      subscription_status: status,
      blocked_at: ["canceled", "unpaid", "past_due"].includes(status) 
        ? new Date().toISOString() 
        : null,
      block_reason: status === "canceled" 
        ? "Assinatura cancelada" 
        : status === "past_due" 
          ? "Pagamento atrasado" 
          : null,
    })
    .eq("id", empresaId);

  console.log("Assinatura atualizada:", empresaId, status);
}

// Handler: Assinatura cancelada
async function handleSubscriptionCanceled(supabase: any, subscription: any) {
  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("empresa_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!assinatura) {
    console.log("Assinatura não encontrada para cancelamento");
    return;
  }

  await supabase
    .from("assinaturas")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", assinatura.empresa_id);

  await supabase
    .from("empresas")
    .update({
      subscription_status: "canceled",
      blocked_at: new Date().toISOString(),
      block_reason: "Assinatura cancelada",
    })
    .eq("id", assinatura.empresa_id);

  console.log("Assinatura cancelada:", assinatura.empresa_id);
}

// Handler: Invoice pago
async function handleInvoicePaid(supabase: any, invoice: any) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) return;

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("id, empresa_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!assinatura) return;

  // Registrar pagamento
  await supabase.from("pagamentos_assinatura").insert({
    assinatura_id: assinatura.id,
    empresa_id: assinatura.empresa_id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    stripe_invoice_id: invoice.id,
    valor: (invoice.amount_paid || 0) / 100, // Converter de centavos
    status: "succeeded",
    metodo_pagamento: "card",
    descricao: invoice.description || `Pagamento ${invoice.billing_reason}`,
    metadata: {
      billing_reason: invoice.billing_reason,
      hosted_invoice_url: invoice.hosted_invoice_url,
    },
  });

  console.log("Pagamento registrado:", assinatura.empresa_id);
}

// Handler: Falha no pagamento
async function handleInvoicePaymentFailed(supabase: any, invoice: any) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) return;

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("id, empresa_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!assinatura) return;

  // Atualizar status
  await supabase
    .from("assinaturas")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", assinatura.empresa_id);

  await supabase
    .from("empresas")
    .update({
      subscription_status: "past_due",
    })
    .eq("id", assinatura.empresa_id);

  // Registrar tentativa de pagamento
  await supabase.from("pagamentos_assinatura").insert({
    assinatura_id: assinatura.id,
    empresa_id: assinatura.empresa_id,
    stripe_invoice_id: invoice.id,
    valor: (invoice.amount_due || 0) / 100,
    status: "failed",
    metodo_pagamento: "card",
    descricao: "Falha no pagamento",
  });

  console.log("Falha no pagamento:", assinatura.empresa_id);
}

// Handler: Reembolso
async function handleChargeRefunded(supabase: any, charge: any) {
  // Se for reembolso de assinatura
  if (charge.metadata?.assinatura_id) {
    await supabase
      .from("reembolsos")
      .update({
        status: "succeeded",
        stripe_refund_id: charge.refunds?.data[0]?.id,
        processado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("assinatura_id", charge.metadata.assinatura_id)
      .eq("status", "processing");
  }

  // Se for reembolso de pedido
  if (charge.metadata?.pedido_delivery_id) {
    await supabase
      .from("reembolsos")
      .update({
        status: "succeeded",
        stripe_refund_id: charge.refunds?.data[0]?.id,
        processado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("pedido_delivery_id", charge.metadata.pedido_delivery_id)
      .eq("status", "processing");
  }

  console.log("Reembolso processado:", charge.id);
}

// Mapear status do Stripe para nosso enum
function mapStripeStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    incomplete: "unpaid",
    incomplete_expired: "canceled",
    paused: "paused",
  };

  return statusMap[stripeStatus] || "active";
}
