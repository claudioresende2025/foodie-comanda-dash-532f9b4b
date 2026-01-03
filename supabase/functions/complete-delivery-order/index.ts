import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[COMPLETE-ORDER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Configuração do servidor incompleta.");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    logStep("Request body received", body);

    const { sessionId } = body;

    if (!sessionId) {
      throw new Error("sessionId é obrigatório.");
    }

    // Buscar sessão do Stripe
    logStep("Fetching Stripe session", { sessionId });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== "paid") {
      logStep("ERROR: Payment not confirmed", { 
        paymentStatus: session?.payment_status 
      });
      throw new Error("Pagamento não confirmado.");
    }

    const orderData = session.metadata as any;
    if (!orderData) {
      throw new Error("Metadados do pedido não encontrados.");
    }

    logStep("Payment confirmed, creating order in database", orderData);

    // Criar pedido no banco de dados
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos_delivery")
      .insert({
        empresa_id: orderData.empresaId,
        endereco_id: orderData.enderecoId,
        status: "pago",
        subtotal: parseFloat(orderData.subtotal),
        taxa_entrega: parseFloat(orderData.taxaEntrega || 0),
        desconto: orderData.desconto ? parseFloat(orderData.desconto) : null,
        total: parseFloat(orderData.total),
        forma_pagamento: "cartao_credito",
        cupom_id: orderData.cupomId || null,
        notas: orderData.notas || null,
        user_id: orderData.userId,
        stripe_session_id: sessionId,
      })
      .select()
      .single();

    if (pedidoError) {
      logStep("ERROR: Failed to create order", pedidoError);
      throw new Error("Erro ao criar pedido no banco de dados.");
    }

    logStep("Order created successfully", { pedidoId: pedido.id });

    // Inserir itens do pedido
    const items = JSON.parse(orderData.items);
    const { error: itemsError } = await supabase
      .from("itens_delivery")
      .insert(
        items.map((item: any) => ({
          pedido_delivery_id: pedido.id,
          produto_id: item.produto_id,
          nome_produto: item.nome_produto,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
        }))
      );

    if (itemsError) {
      logStep("ERROR: Failed to insert items", itemsError);
      throw new Error("Erro ao inserir itens do pedido.");
    }

    // Registrar uso do cupom se aplicável
    if (orderData.cupomId) {
      await supabase.from("cupons_uso").insert({
        cupom_id: orderData.cupomId,
        user_id: orderData.userId,
        pedido_delivery_id: pedido.id,
        valor_desconto: parseFloat(orderData.desconto || 0),
      });

      logStep("Coupon usage registered", { cupomId: orderData.cupomId });
    }

    logStep("Order completed successfully", { pedidoId: pedido.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId: pedido.id,
        message: "Pedido criado com sucesso!" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno no servidor";
    logStep("ERROR", { message: errorMessage, error: String(error) });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
