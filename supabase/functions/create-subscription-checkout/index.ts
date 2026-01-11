import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

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

    if (empresaId && !stripeCustomerId) {
      // Criar customer no Stripe usando dados da empresa
      const customer = await stripe.customers.create({
        email: empresa?.email,
        name: empresa?.nome_fantasia,
        metadata: {
          empresa_id: empresaId,
        },
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
      const product = await stripe.products.create({
        name: `${plano.nome} - ${periodo === "anual" ? "Anual" : "Mensal"}`,
        description: plano.descricao,
        metadata: {
          plano_id: planoId,
          periodo,
        },
      });

      // Criar preço
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(preco * 100), // Stripe usa centavos
        currency: "brl",
        recurring: {
          interval: periodo === "anual" ? "year" : "month",
        },
        metadata: {
          plano_id: planoId,
          periodo,
        },
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

    const session = await stripe.checkout.sessions.create({
      // Se temos customer id, definir customer, caso contrário deixar Stripe coletar e criar
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: trial_days ?? plano.trial_days ?? 3,
        metadata: subscriptionMetadata,
      },
      success_url: successUrl || `${req.headers.get("origin")}/admin?subscription=success&planoId=${planoId}`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/planos?canceled=true`,
      metadata: subscriptionMetadata,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      locale: "pt-BR",
    });

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
