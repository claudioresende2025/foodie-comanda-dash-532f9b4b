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
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error?.message || JSON.stringify(json));
      return json;
    };

    const { planoId, empresaId, periodo, successUrl, cancelUrl, trial_days } = await req.json();

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

    // Buscar empresa apenas se fornecida (permite checkout sem login)
    let empresa: any = null;
    if (empresaId) {
      const { data: emp, error: empresaError } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", empresaId)
        .single();
      if (!empresaError && emp) {
        empresa = emp;
      }
    }

    // Buscar assinatura somente se empresaId existir
    let assinatura: any = null;
    if (empresaId) {
      const { data: found } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      assinatura = found;
    }

    // Verificar se já tem um customer no Stripe (somente se empresaId for fornecida)
    let stripeCustomerId = assinatura?.stripe_customer_id;
    if (empresaId && !stripeCustomerId && empresa) {
      const customer = await stripeRequest('customers', 'POST', {
        email: empresa?.email,
        name: empresa?.nome_fantasia,
        metadata: { empresa_id: empresaId }
      });
      stripeCustomerId = customer.id;
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
      success_url: successUrl || `${req.headers.get('origin')}/admin?subscription=success&planoId=${planoId}`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/planos?canceled=true`,
      allow_promotion_codes: 'true',
      billing_address_collection: 'required',
      locale: 'pt-BR'
    };

    const days = trial_days ?? plano.trial_days ?? 3;
    if (days > 0) {
      sessionPayload['subscription_data[trial_period_days]'] = String(days);
    }

    // metadata
    sessionPayload['metadata[plano_id]'] = planoId;
    sessionPayload['metadata[periodo]'] = periodo;
    if (empresaId) sessionPayload['metadata[empresa_id]'] = empresaId;
    if (stripeCustomerId) sessionPayload['customer'] = stripeCustomerId;

    const session = await stripeRequest('checkout/sessions', 'POST', sessionPayload);

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
