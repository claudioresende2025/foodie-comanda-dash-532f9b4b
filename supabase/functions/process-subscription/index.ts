import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId, empresaId, planoId: planoIdInput, periodo: periodoInput } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY não configurado");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const stripeRequest = async (path: string, method = 'GET') => {
      const url = `https://api.stripe.com/v1/${path}`;
      const resp = await fetch(url, { method, headers: { Authorization: `Bearer ${stripeSecretKey}`, Accept: 'application/json' } });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      return resp.json();
    };

    if (!sessionId) throw new Error("sessionId é obrigatório");
    if (!empresaId) throw new Error("empresaId é obrigatório");

    logStep("Iniciando processamento", { sessionId, empresaId, planoIdInput, periodoInput });

    // Recuperar sessão e subscription
    const session = await stripeRequest(`checkout/sessions/${sessionId}`);
    const subscriptionId = session.subscription as string;
    
    logStep("Sessão recuperada", { subscriptionId, customer: session.customer });

    if (!subscriptionId) throw new Error("subscription id não encontrado na session");

    const subscription = await stripeRequest(`subscriptions/${subscriptionId}`);

    logStep("Subscription recuperada", { status: subscription.status, metadata: subscription.metadata });

    // Mapear status
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

    // Inferir plano_id e período
    let planoId = (planoIdInput as string | undefined) || (subscription.metadata?.plano_id as string | undefined);
    const periodo = (periodoInput as string | undefined) || (subscription.metadata?.periodo as string | undefined) || 'mensal';

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
      }
    }

<<<<<<< HEAD
    if (!planoId) {
      // Fallback: buscar qualquer plano ativo
      const { data: anyPlan } = await supabase
        .from("planos")
        .select("id")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (anyPlan?.id) planoId = anyPlan.id;
    }
=======
    const currentStartISO = subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null;
    const currentEndISO = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
    const trialStartISO = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
    // Fallback: se trial_end vier vazio, usar current_period_end para representar fim do trial
    const trialEndISO = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000).toISOString() 
      : currentEndISO;

    const updateData: Record<string, any> = {
      status,
      current_period_start: currentStartISO,
      current_period_end: currentEndISO,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
      trial_start: trialStartISO,
      trial_end: trialEndISO,
    };
>>>>>>> 178f6ed (autosync: update 2026-01-15T11:29:02.670Z)

    if (!planoId) {
      throw new Error("Não foi possível determinar o plano da assinatura");
    }

    logStep("Plano identificado", { planoId, periodo, status });

    // Calcular datas
    const currentStartISO = subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null;
    const currentEndISO = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
    const trialStartISO = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
    const trialEndISO = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000).toISOString() 
      : currentEndISO;

    // Upsert assinatura
    const { error: upsertError } = await supabase
      .from('assinaturas')
      .upsert({
        empresa_id: empresaId,
        plano_id: planoId,
        status: status,
        periodo: periodo,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        trial_start: trialStartISO,
        trial_end: trialEndISO,
        current_period_start: currentStartISO,
        current_period_end: currentEndISO,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' });

    if (upsertError) {
      logStep("Erro no upsert", { error: upsertError });
      throw new Error(`Erro ao salvar assinatura: ${upsertError.message}`);
    }

    logStep("Assinatura salva com sucesso", { empresaId, planoId, status });

    return new Response(JSON.stringify({ 
      success: true,
      empresaId,
      planoId,
      status,
      subscriptionId: subscription.id
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: any) {
    logStep('ERRO', { message: err.message || String(err) });
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message || String(err) 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
