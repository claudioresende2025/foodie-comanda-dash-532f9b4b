import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DELIVERY-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Verificar variáveis de ambiente
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not found");
      throw new Error("Configuração da chave Stripe não encontrada.");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      logStep("ERROR: Supabase credentials not found");
      throw new Error("Configuração do Supabase não encontrada.");
    }

    logStep("Stripe key verified");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Criar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    logStep("Request body received", body);

    const { 
      orderData, // Dados do pedido (sem criar no banco ainda)
      total: clientTotal 
    } = body;

    if (!orderData || !orderData.empresaId) {
      logStep("ERROR: Missing orderData");
      throw new Error("Dados do pedido são obrigatórios.");
    }

    // VALIDAÇÃO: Recalcular total do pedido
    const subtotal = parseFloat(orderData.subtotal);
    const taxaEntrega = parseFloat(orderData.taxaEntrega || 0);
    const desconto = parseFloat(orderData.desconto || 0);
    const calculatedTotal = subtotal + taxaEntrega - desconto;

    logStep("Total validation", { 
      clientTotal, 
      calculatedTotal,
      subtotal,
      taxaEntrega,
      desconto
    });

    // VALIDAÇÃO CRÍTICA: Comparar total do cliente com total calculado
    const tolerance = 0.01;
    if (Math.abs(clientTotal - calculatedTotal) > tolerance) {
      logStep("ERROR: Total mismatch", { 
        clientTotal, 
        calculatedTotal 
      });
      throw new Error("O valor do pedido foi alterado. Por favor, atualize a página e tente novamente.");
    }

    const validatedTotal = calculatedTotal;

    logStep("Creating checkout session WITHOUT creating order", { 
      validatedTotal, 
      amountInCents: Math.round(validatedTotal * 100) 
    });

    const origin = req.headers.get("origin") || "https://preview--foodcomandapro.lovable.app";
    logStep("Using origin", { origin });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Pedido Delivery - ${orderData.empresaNome || 'Restaurante'}`,
              description: "Pagamento do seu pedido no Delivery",
            },
            unit_amount: Math.round(validatedTotal * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/delivery/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/delivery?canceled=true`,
      metadata: {
        empresaId: orderData.empresaId,
        enderecoId: orderData.enderecoId,
        userId: orderData.userId,
        subtotal: orderData.subtotal.toString(),
        taxaEntrega: orderData.taxaEntrega.toString(),
        desconto: orderData.desconto?.toString() || "0",
        total: validatedTotal.toString(),
        cupomId: orderData.cupomId || "",
        notas: orderData.notas || "",
        items: JSON.stringify(orderData.items), // Array de itens
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno no servidor de pagamento";
    logStep("ERROR", { message: errorMessage, error: String(error) });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
