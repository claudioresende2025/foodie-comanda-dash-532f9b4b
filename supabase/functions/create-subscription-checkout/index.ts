import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    // Helper simples para chamar a API do Stripe via REST, evitando SDKs que
    // trazem shims do Node que não funcionam no runtime do Supabase Edge.
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
      const text = await resp.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!resp.ok) {
        console.error('[stripeRequest] non-ok response', { path, status: resp.status, body: json });
        throw new Error(json.error?.message || JSON.stringify(json));
      }
      return json;
    };

    const requestBody = await req.json();
    const { planoId, empresaId, periodo, successUrl, cancelUrl, trial_days } = requestBody;

    if (!planoId) {
      throw new Error("planoId é obrigatório");
    }

    // Persist request for debugging
    try {
      console.log('[create-subscription-checkout] request body:', JSON.stringify(requestBody));
      await supabase.from('webhook_logs').insert({
        event: 'create_checkout_request',
        referencia: null,
        empresa_id: empresaId || null,
        payload: JSON.stringify({ requestBody }),
        created_at: new Date().toISOString(),
      });
    } catch (e: unknown) {
      console.warn('Erro ao gravar create_checkout_request em webhook_logs:', e instanceof Error ? e.message : e);
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

    // Buscar empresa
    const { data: empresa, error: empresaError } = await supabase
      .from("empresas")
      .select("*")
      .eq("id", empresaId)
      .single();

    if (empresaError || !empresa) {
      throw new Error("Empresa não encontrada");
    }

    // Buscar ou criar assinatura
    let { data: assinatura } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("empresa_id", empresaId)
      .single();

    // Verificar se já tem um customer no Stripe (somente se empresaId for fornecida)
    let stripeCustomerId = assinatura?.stripe_customer_id;
    // If we have a stored customer id, validate it exists in Stripe. If it doesn't, clear it so we recreate.
    if (stripeCustomerId) {
      try {
        await stripeRequest(`customers/${stripeCustomerId}`);
      } catch (err: unknown) {
        console.warn('[create-subscription-checkout] stored stripe customer not found, will recreate:', stripeCustomerId, err instanceof Error ? err.message : err);
        // Clear local reference so we create a fresh customer below
        try {
          if (assinatura) {
            await supabase.from('assinaturas').update({ stripe_customer_id: null }).eq('id', assinatura.id);
          }
        } catch (upErr: unknown) {
          console.warn('Failed to clear stale stripe_customer_id in DB:', upErr instanceof Error ? upErr.message : upErr);
        }
        stripeCustomerId = undefined;
      }
    }

    if (empresaId && !stripeCustomerId) {
      // Criar customer no Stripe usando dados da empresa
        const customer = await stripeRequest('customers', 'POST', {
          email: empresa?.email,
          name: empresa?.nome_fantasia,
          metadata: { empresa_id: empresaId }
        });
        stripeCustomerId = customer.id;

      // Atualizar assinatura com o customer ID
      if (assinatura) {
        await supabase
          .from("assinaturas")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", assinatura.id);
      }
    }

    // Determinar preço e price_id
    const preco = periodo === "anual" ? plano.preco_anual : plano.preco_mensal;
    let stripePriceId = periodo === "anual" 
      ? plano.stripe_price_id_anual 
      : plano.stripe_price_id_mensal;

    // Se não tem price_id configurado, criar um produto/preço no Stripe
    if (!stripePriceId) {
      // Criar produto
      const product = await stripeRequest('products', 'POST', {
        name: `${plano.nome} - ${periodo === 'anual' ? 'Anual' : 'Mensal'}`,
        description: plano.descricao,
        metadata: { plano_id: planoId, periodo }
      });

      // Criar preço
      const price = await stripeRequest('prices', 'POST', {
        product: product.id,
        unit_amount: Math.round(preco * 100), // Stripe usa centavos
        currency: 'brl',
        'recurring[interval]': periodo === 'anual' ? 'year' : 'month',
        metadata: { plano_id: planoId, periodo }
      });

      stripePriceId = price.id;

      // Salvar price_id no plano para uso futuro
      const updateField = periodo === "anual" 
        ? { stripe_price_id_anual: stripePriceId }
        : { stripe_price_id_mensal: stripePriceId };

      await supabase
        .from("planos")
        .update(updateField)
        .eq("id", planoId);
    }

    // Garantir um origin válido (fallback para variáveis de ambiente)
    const origin = req.headers.get('origin') || Deno.env.get('FRONTEND_URL') || Deno.env.get('APP_URL') || 'https://foodie-comanda-dash.lovable.app';

    // Criar sessão de checkout
    const subscriptionMetadata: any = {
      plano_id: planoId,
      periodo,
    };
    if (empresaId) subscriptionMetadata.empresa_id = empresaId;

    const sessionPayload: any = {
      mode: 'subscription',
      'payment_method_types[]': 'card',
      'line_items[0][price]': stripePriceId,
      'line_items[0][quantity]': '1',
      success_url: successUrl || `${origin}/admin?subscription=success&planoId=${planoId}`,
      cancel_url: cancelUrl || `${origin}/planos?canceled=true`,
      allow_promotion_codes: 'true',
      billing_address_collection: 'required',
      locale: 'pt-BR'
    };

    // Trial days: if explicit `trial_days` provided and >0, include it. If 0 provided, omit (no trial).
    const requestedTrial = typeof trial_days !== 'undefined' ? Number(trial_days) : (plano.trial_days ?? 3);
    if (requestedTrial > 0) {
      sessionPayload['subscription_data[trial_period_days]'] = String(requestedTrial);
    }

    // metadata
    sessionPayload['metadata[plano_id]'] = planoId;
    sessionPayload['metadata[periodo]'] = periodo;
    if (empresaId) sessionPayload['metadata[empresa_id]'] = empresaId;
    if (stripeCustomerId) sessionPayload['customer'] = stripeCustomerId;

    // Garantia adicional: success_url e cancel_url devem ser URLs absolutas
    const ensureAbsoluteUrl = (u: any) => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : null;
    if (!ensureAbsoluteUrl(successUrl || `${origin}/admin?subscription=success&planoId=${planoId}`)) {
      console.warn('[create-subscription-checkout] success_url inválida:', successUrl);
    }

    let session: any;
    try {
      session = await stripeRequest('checkout/sessions', 'POST', sessionPayload);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('Erro ao criar session no Stripe:', errMsg);
      try {
        await supabase.from('webhook_logs').insert({
          event: 'create_checkout_error',
          referencia: null,
          empresa_id: empresaId || null,
          payload: JSON.stringify({ error: errMsg, sessionPayload }),
          created_at: new Date().toISOString(),
        });
      } catch (ee: unknown) {
        console.warn('Não foi possível inserir create_checkout_error em webhook_logs:', ee instanceof Error ? ee.message : ee);
      }
      throw e;
    }

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro ao criar checkout:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
