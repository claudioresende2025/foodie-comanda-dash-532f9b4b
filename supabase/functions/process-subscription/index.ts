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
    
    logStep("Sessão recuperada", { subscriptionId, customer: session.customer, metadata: session.metadata });

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

    // IMPORTANTE: Priorizar planoId recebido como parâmetro, depois da session metadata, depois da subscription metadata
    let planoId = planoIdInput || session.metadata?.plano_id || subscription.metadata?.plano_id;
    const periodo = periodoInput || session.metadata?.periodo || subscription.metadata?.periodo || 'mensal';

    logStep("Plano inicial", { planoId, periodo, fromInput: !!planoIdInput, fromSession: !!session.metadata?.plano_id });

    // Se ainda não tem planoId, tentar encontrar pelo price_id
    if (!planoId && subscription.items?.data?.length > 0) {
      const priceId = subscription.items.data[0].price?.id;
      logStep("Buscando plano por price_id", { priceId });
      
      if (priceId) {
        // Tentar encontrar plano pelo price_id
        const { data: planoMensal } = await supabase
          .from("planos")
          .select("id, nome")
          .eq("stripe_price_id_mensal", priceId)
          .maybeSingle();
        
        if (planoMensal?.id) {
          planoId = planoMensal.id;
          logStep("Plano encontrado por price_id mensal", { planoId, nome: planoMensal.nome });
        }

        if (!planoId) {
          const { data: planoAnual } = await supabase
            .from("planos")
            .select("id, nome")
            .eq("stripe_price_id_anual", priceId)
            .maybeSingle();
          
          if (planoAnual?.id) {
            planoId = planoAnual.id;
            logStep("Plano encontrado por price_id anual", { planoId, nome: planoAnual.nome });
          }
        }
      }
    }

    // Último fallback: primeiro plano ativo (só se não encontrou de nenhuma forma)
    if (!planoId) {
      logStep("AVISO: Usando fallback para primeiro plano - isso não deveria acontecer!");
      const { data: anyPlan } = await supabase
        .from("planos")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (anyPlan?.id) {
        planoId = anyPlan.id;
        logStep("Usando fallback", { planoId, nome: anyPlan.nome });
      }
    }

    if (!planoId) {
      throw new Error("Não foi possível determinar o plano da assinatura");
    }

    // Verificar se o plano existe
    const { data: planoCheck, error: planoCheckError } = await supabase
      .from("planos")
      .select("id, nome")
      .eq("id", planoId)
      .single();
    
    if (planoCheckError || !planoCheck) {
      logStep("ERRO: Plano não encontrado no banco", { planoId, error: planoCheckError });
      throw new Error(`Plano ${planoId} não encontrado`);
    }

    logStep("Plano confirmado", { planoId, nome: planoCheck.nome, periodo, status });

    // Calcular datas - usando os nomes corretos das colunas da tabela
    const dataInicio = subscription.current_period_start 
      ? new Date(subscription.current_period_start * 1000).toISOString() 
      : new Date().toISOString();
    
    const dataFim = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString() 
      : null;
    
    const trialFim = subscription.trial_end 
      ? new Date(subscription.trial_end * 1000).toISOString() 
      : null;

    logStep("Datas calculadas", { dataInicio, dataFim, trialFim });

    // Upsert assinatura - usando os nomes corretos das colunas
    const { error: upsertError } = await supabase
      .from('assinaturas')
      .upsert({
        empresa_id: empresaId,
        plano_id: planoId,
        status: status,
        periodo: periodo,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        data_inicio: dataInicio,
        data_fim: dataFim,
        trial_fim: trialFim,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' });

    if (upsertError) {
      logStep("Erro no upsert", { error: upsertError });
      throw new Error(`Erro ao salvar assinatura: ${upsertError.message}`);
    }

    logStep("Assinatura salva com sucesso", { empresaId, planoId, planoNome: planoCheck.nome, status });

    // Buscar assinatura para obter o ID
    const { data: assinaturaData } = await supabase
      .from('assinaturas')
      .select('id')
      .eq('empresa_id', empresaId)
      .single();

    // Buscar preço do plano
    const { data: planoPreco } = await supabase
      .from('planos')
      .select('preco_mensal, preco_anual')
      .eq('id', planoId)
      .single();

    const valorPagamento = periodo === 'anual' 
      ? (planoPreco?.preco_anual || 0) 
      : (planoPreco?.preco_mensal || 0);

    // Registrar pagamento inicial (se houver payment_intent na session)
    if (session.payment_intent && assinaturaData?.id) {
      // Verificar se já existe pagamento com esse payment_intent
      const { data: existingPayment } = await supabase
        .from('pagamentos_assinatura')
        .select('id')
        .eq('stripe_payment_intent_id', session.payment_intent)
        .maybeSingle();

      if (!existingPayment) {
        const { error: pagamentoError } = await supabase
          .from('pagamentos_assinatura')
          .insert({
            empresa_id: empresaId,
            assinatura_id: assinaturaData.id,
            valor: valorPagamento,
            status: 'succeeded',
            metodo_pagamento: 'stripe',
            descricao: `Assinatura ${planoCheck.nome} - ${periodo}`,
            stripe_payment_intent_id: session.payment_intent,
            metadata: {
              stripe_session_id: sessionId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: session.customer,
              plano_nome: planoCheck.nome
            }
          });

        if (pagamentoError) {
          logStep("Erro ao registrar pagamento", { error: pagamentoError.message });
        } else {
          logStep("Pagamento inicial registrado com sucesso");
        }
      } else {
        logStep("Pagamento já registrado anteriormente");
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      empresaId,
      planoId,
      planoNome: planoCheck.nome,
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
