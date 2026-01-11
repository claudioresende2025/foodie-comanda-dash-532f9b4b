import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verificar assinatura do webhook (se configurado)
    if (stripeWebhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
      } catch (err: any) {
        console.error("Erro na verificação do webhook:", err.message);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }
    } else {
      // Sem verificação (desenvolvimento)
      event = JSON.parse(body);
    }

    console.log("Evento recebido:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, stripe, session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
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
async function handleCheckoutCompleted(supabase: any, stripe: Stripe, session: Stripe.Checkout.Session) {
  const empresaId = session.metadata?.empresa_id;
  const planoId = session.metadata?.plano_id;
  const periodo = session.metadata?.periodo || "mensal";

  if (!empresaId) {
    console.error("empresa_id não encontrado no metadata");
    return;
  }

  // Buscar subscription ID
  const subscriptionId = session.subscription as string;
  
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Atualizar ou criar assinatura no banco
    const { error } = await supabase
      .from("assinaturas")
      .upsert({
        empresa_id: empresaId,
        plano_id: planoId,
        status: subscription.status === "trialing" ? "trialing" : "active",
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscriptionId,
        periodo,
        trial_start: subscription.trial_start 
          ? new Date(subscription.trial_start * 1000).toISOString() 
          : null,
        trial_end: subscription.trial_end 
          ? new Date(subscription.trial_end * 1000).toISOString() 
          : null,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "empresa_id",
      });

    if (error) {
      console.error("Erro ao atualizar assinatura:", error);
    }

    // Atualizar status na empresa
    await supabase
      .from("empresas")
      .update({
        subscription_status: subscription.status === "trialing" ? "trialing" : "active",
        blocked_at: null,
        block_reason: null,
      })
      .eq("id", empresaId);
  }

  console.log("Checkout concluído para empresa:", empresaId);
  // Enviar e-mail para o cliente (se disponível) com link para login/cadastro
  try {
    let email = session.customer_details?.email || (session.customer_email as string | undefined);

    if (!email && session.customer) {
      const customer = await stripe.customers.retrieve(session.customer as string) as any;
      email = customer?.email;
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
async function handleSubscriptionUpdated(supabase: any, subscription: Stripe.Subscription) {
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

    await updateSubscriptionInDB(supabase, assinatura.empresa_id, subscription);
  } else {
    await updateSubscriptionInDB(supabase, empresaId, subscription);
  }
}

async function updateSubscriptionInDB(supabase: any, empresaId: string, subscription: Stripe.Subscription) {
  const status = mapStripeStatus(subscription.status);

  // Buscar plano_id dos metadados da subscription ou do price
  let planoId = subscription.metadata?.plano_id;
  
  // Se não tem nos metadados, tentar buscar do primeiro item
  if (!planoId && subscription.items?.data?.length > 0) {
    const priceId = subscription.items.data[0].price?.id;
    if (priceId) {
      // Buscar plano pelo stripe_price_id
      const { data: plano } = await supabase
        .from("planos")
        .select("id")
        .or(`stripe_price_id_mensal.eq.${priceId},stripe_price_id_anual.eq.${priceId}`)
        .maybeSingle();
      
      if (plano?.id) {
        planoId = plano.id;
        console.log("Plano encontrado via price_id:", planoId);
      }
    }
  }

  const updateData: Record<string, any> = {
    status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at 
      ? new Date(subscription.canceled_at * 1000).toISOString() 
      : null,
    updated_at: new Date().toISOString(),
  };

  // Atualizar plano_id se encontrado (upgrade/downgrade)
  if (planoId) {
    updateData.plano_id = planoId;
    console.log("Atualizando plano_id para:", planoId);
  }

  await supabase
    .from("assinaturas")
    .update(updateData)
    .eq("empresa_id", empresaId);

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
async function handleSubscriptionCanceled(supabase: any, subscription: Stripe.Subscription) {
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
async function handleInvoicePaid(supabase: any, invoice: Stripe.Invoice) {
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
async function handleInvoicePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
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
async function handleChargeRefunded(supabase: any, charge: Stripe.Charge) {
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
