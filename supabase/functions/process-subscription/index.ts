import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Evitar uso do SDK do Stripe (esm.sh) para não depender de shims Node
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId, empresaId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY não configurado");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripeSecret = stripeSecretKey;
    const stripeRequest = async (path: string, method = 'GET') => {
      const url = `https://api.stripe.com/v1/${path}`;
      const resp = await fetch(url, { method, headers: { Authorization: `Bearer ${stripeSecret}`, Accept: 'application/json' } });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      return resp.json();
    };

    if (!sessionId) throw new Error("sessionId é obrigatório");
    if (!empresaId) throw new Error("empresaId é obrigatório");

    // Recuperar sessão e subscription
    const session = await stripeRequest(`checkout/sessions/${sessionId}`);
    const subscriptionId = session.subscription as string;
    if (!subscriptionId) throw new Error("subscription id não encontrado na session");

    const subscription = await stripeRequest(`subscriptions/${subscriptionId}`);

    // Reaproveita a lógica do webhook: inferir plano pelo metadata/price/product
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

    const status = statusMap[subscription.status] || "active";

    // Inferir plano_id
    let planoId = subscription.metadata?.plano_id as string | undefined;

    if (!planoId && subscription.items?.data?.length > 0) {
      const priceId = subscription.items.data[0].price?.id;
      if (priceId) {
        // Tentar encontrar plano pelo price_id
        const { data: planoMensal } = await supabase
          .from("planos")
          .select("id")
          .eq("stripe_price_id_mensal", priceId)
          .maybeSingle();
        if (planoMensal?.id) planoId = planoMensal.id;

        if (!planoId) {
          const { data: planoAnual } = await supabase
            .from("planos")
            .select("id")
            .eq("stripe_price_id_anual", priceId)
            .maybeSingle();
          if (planoAnual?.id) planoId = planoAnual.id;
        }

        if (!planoId) {
          const productId = subscription.items.data[0].price?.product;
          if (productId && typeof productId === 'string') {
            const { data: planoByProduct } = await supabase
              .from('planos')
              .select('id')
              .eq('stripe_product_id', productId)
              .maybeSingle();
            if (planoByProduct?.id) planoId = planoByProduct.id;
          }
        }
      }
    }

    const updateData: Record<string, any> = {
      status,
      current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
      current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (planoId) updateData.plano_id = planoId;

    // Upsert assinatura
    await supabase
      .from('assinaturas')
      .upsert({
        empresa_id: empresaId,
        plano_id: updateData.plano_id,
        status: updateData.status,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        periodo: subscription.metadata?.periodo || null,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        current_period_start: updateData.current_period_start,
        current_period_end: updateData.current_period_end,
        updated_at: updateData.updated_at,
      }, { onConflict: 'empresa_id' });

    // Atualizar empresa
    await supabase
      .from('empresas')
      .update({
        subscription_status: status,
        blocked_at: ['canceled', 'unpaid', 'past_due'].includes(status) ? new Date().toISOString() : null,
        block_reason: status === 'canceled' ? 'Assinatura cancelada' : status === 'past_due' ? 'Pagamento atrasado' : null,
      })
      .eq('id', empresaId);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Erro em process-subscription:', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
