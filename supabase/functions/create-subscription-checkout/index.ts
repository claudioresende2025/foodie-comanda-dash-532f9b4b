import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

declare const Deno: { env: { get(name: string): string | undefined } };
const getErrorMessage = (e: unknown): string => {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: string }).message;
    return m ? String(m) : String(e);
  }
  try { return JSON.stringify(e as any); } catch { return String(e); }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new Error("Stripe não configurado. Configure STRIPE_SECRET_KEY nos secrets.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripeSecret = stripeSecretKey;

    // Helper simples para chamar a API do Stripe via REST
    const stripeRequest = async (path: string, method = 'GET', body?: Record<string, any>) => {
      const url = `https://api.stripe.com/v1/${path}`;
      const headers: Record<string,string> = {
        Authorization: `Bearer ${stripeSecret}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      let bodyData: string | undefined;
      if (body) {
        const params = new URLSearchParams();
        const build = (obj: any, prefix = '') => {
          for (const key of Object.keys(obj || {})) {
            const val = obj[key];
            const name = prefix ? `${prefix}[${key}]` : key;
            if (val === undefined || val === null) continue;
            if (typeof val === 'object' && !(val instanceof Date)) {
              build(val, name);
            } else {
              params.append(name, String(val));
            }
          }
        };
        build(body);
        bodyData = params.toString();
      }

      const resp = await fetch(url, { method, headers, body: bodyData });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error?.message || JSON.stringify(json));
      return json;
    };

    const { planoId, empresaId, periodo, successUrl, cancelUrl, trial_days, customerEmail, isUpgrade } = await req.json();

    logStep("Requisição recebida", { planoId, empresaId, periodo, customerEmail, isUpgrade, trial_days });

    if (!planoId) {
      throw new Error("planoId é obrigatório");
    }

    // Buscar plano
    const { data: plano, error: planoError } = await supabase
      .from("planos")
      .select("*")
      .eq("id", planoId)
      .single();

    if (planoError || !plano) {
      throw new Error("Plano não encontrado");
    }

    logStep("Plano encontrado", { nome: plano.nome, slug: plano.slug });

    // Buscar empresa apenas se fornecida (permite checkout sem login)
    let empresa: any = null;
    let emailForCheckout = customerEmail || null;
    let existingSubscription: any = null;

    if (empresaId) {
      const { data: emp, error: empresaError } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", empresaId)
        .single();
      if (!empresaError && emp) {
        empresa = emp;
        if (emp.email) emailForCheckout = emailForCheckout || emp.email;
      }

      // Verificar assinatura existente
      const { data: found } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      existingSubscription = found;
      
      logStep("Assinatura existente", { 
        hasSubscription: !!found, 
        status: found?.status, 
        currentPlanoId: found?.plano_id 
      });
    }

    // Verificar se já tem um customer no Stripe
    let stripeCustomerId = existingSubscription?.stripe_customer_id;
    if (empresaId && !stripeCustomerId && empresa) {
      const customer = await stripeRequest('customers', 'POST', {
        email: emailForCheckout || empresa?.email,
        name: empresa?.nome_fantasia,
        metadata: { empresa_id: empresaId }
      });
      stripeCustomerId = customer.id;
      logStep("Cliente Stripe criado", { stripeCustomerId });
      
      if (existingSubscription) {
        await supabase
          .from("assinaturas")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", existingSubscription.id);
      }
    }

    // Determinar preço e price_id
    const preco = periodo === "anual" ? plano.preco_anual : plano.preco_mensal;
    let stripePriceId = periodo === "anual" 
      ? plano.stripe_price_id_anual 
      : plano.stripe_price_id_mensal;

    // Se não tem price_id configurado, criar um produto/preço no Stripe
    if (!stripePriceId) {
      logStep("Criando produto/preço no Stripe", { planoNome: plano.nome, preco, periodo });
      
      const product = await stripeRequest('products', 'POST', {
        name: `${plano.nome} - ${periodo === 'anual' ? 'Anual' : 'Mensal'}`,
        description: plano.descricao,
        metadata: { plano_id: planoId, periodo }
      });

      const price = await stripeRequest('prices', 'POST', {
        product: product.id,
        unit_amount: Math.round(preco * 100),
        currency: 'brl',
        'recurring[interval]': periodo === 'anual' ? 'year' : 'month',
        metadata: { plano_id: planoId, periodo }
      });

      stripePriceId = price.id;
      logStep("Preço Stripe criado", { stripePriceId });

      const updateField = periodo === "anual" 
        ? { stripe_price_id_anual: stripePriceId }
        : { stripe_price_id_mensal: stripePriceId };

      await supabase
        .from("planos")
        .update(updateField)
        .eq("id", planoId);
    }

    // Determinar se é upgrade (usuário já tem empresaId E já tem assinatura ativa ou em trial)
    const isActualUpgrade = empresaId && existingSubscription && 
      (existingSubscription.status === 'active' || existingSubscription.status === 'trialing');
    
    logStep("Verificação upgrade", { isActualUpgrade, empresaId: !!empresaId, hasSubscription: !!existingSubscription });

    // Criar sessão de checkout
    const sessionPayload: any = {
      mode: 'subscription',
      'payment_method_types[]': 'card',
      'line_items[0][price]': stripePriceId,
      'line_items[0][quantity]': '1',
      success_url: successUrl || `${req.headers.get('origin')}/subscription/success?session_id={CHECKOUT_SESSION_ID}&planoId=${planoId}&periodo=${periodo}`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/planos?canceled=true`,
      allow_promotion_codes: 'true',
      billing_address_collection: 'required',
      locale: 'pt-BR'
    };

    // IMPORTANTE: Apenas aplicar trial para novos usuários (sem empresaId ou sem assinatura existente)
    const shouldApplyTrial = !isActualUpgrade && !empresaId;
    const trialDays = trial_days ?? plano.trial_days ?? 3;
    
    if (shouldApplyTrial && trialDays > 0) {
      sessionPayload['subscription_data[trial_period_days]'] = String(trialDays);
      logStep("Trial aplicado", { trialDays });
    } else {
      logStep("Sem trial (upgrade ou usuário existente)", { isActualUpgrade, empresaId: !!empresaId });
    }

    // Metadata na sessão (importante para process-subscription)
    sessionPayload['metadata[plano_id]'] = planoId;
    sessionPayload['metadata[periodo]'] = periodo;
    if (empresaId) sessionPayload['metadata[empresa_id]'] = empresaId;
    
    // Metadata na subscription também
    sessionPayload['subscription_data[metadata][plano_id]'] = planoId;
    sessionPayload['subscription_data[metadata][periodo]'] = periodo;
    if (empresaId) sessionPayload['subscription_data[metadata][empresa_id]'] = empresaId;
    
    // Se já temos um customer no Stripe, usá-lo. Caso contrário, pré-preencher email
    if (stripeCustomerId) {
      sessionPayload['customer'] = stripeCustomerId;
      logStep("Usando customer existente", { stripeCustomerId });
    } else if (emailForCheckout) {
      sessionPayload['customer_email'] = emailForCheckout;
      logStep("Pré-preenchendo email", { emailForCheckout });
    }

    const session = await stripeRequest('checkout/sessions', 'POST', sessionPayload);
    logStep("Sessão criada", { sessionId: session.id, url: session.url?.substring(0, 50) + '...' });

    return new Response(JSON.stringify({ success: true, url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro ao criar checkout:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
