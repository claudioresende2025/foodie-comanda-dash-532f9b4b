import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Evitar uso do SDK do Stripe (esm.sh) para não depender de shims Node
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

    logStep("Environment check", { 
      hasStripeKey: !!stripeKey, 
      hasSupabaseUrl: !!supabaseUrl
    });

    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Configuração do servidor incompleta.");
    }

    const stripeSecret = stripeKey;
    const stripeRequest = async (path: string, method = 'GET') => {
      const url = `https://api.stripe.com/v1/${path}`;
      const resp = await fetch(url, { method, headers: { Authorization: `Bearer ${stripeSecret}`, Accept: 'application/json' } });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      return resp.json();
    };

    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    logStep("Request body received", body);

    const { sessionId } = body;

    if (!sessionId) {
      throw new Error("sessionId é obrigatório.");
    }

    // Buscar sessão do Stripe via API
    logStep("Fetching Stripe session", { sessionId });
    const session = await stripeRequest(`checkout/sessions/${sessionId}`);

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

    logStep("Payment confirmed, checking for existing order", orderData);

    // Verificar se o pedido já foi criado para esta sessão (evitar duplicatas)
    const { data: existingOrder } = await supabase
      .from("pedidos_delivery")
      .select("id")
      .eq("stripe_payment_id", sessionId)
      .maybeSingle();

    if (existingOrder) {
      logStep("Order already exists", { pedidoId: existingOrder.id });
      return new Response(
        JSON.stringify({ 
          success: true, 
          orderId: existingOrder.id,
          message: "Pedido já existe!" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    logStep("Creating new order in database", orderData);
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
        stripe_payment_id: sessionId,
        stripe_payment_status: "paid",
      })
      .select()
      .single();

    if (pedidoError) {
      logStep("ERROR: Failed to create order", { 
        error: pedidoError,
        code: pedidoError.code,
        message: pedidoError.message,
        details: pedidoError.details,
        hint: pedidoError.hint
      });
      throw new Error(`Erro ao criar pedido no banco de dados: ${pedidoError.message}`);
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
        valor_desconto: parseFloat(orderData.descontoCupom || orderData.desconto || 0),
      });

      // CORREÇÃO: Incrementar uso_atual do cupom
      const { data: cupomAtual } = await supabase
        .from("cupons")
        .select("uso_atual")
        .eq("id", orderData.cupomId)
        .single();
      
      if (cupomAtual) {
        await supabase
          .from("cupons")
          .update({ uso_atual: (cupomAtual.uso_atual || 0) + 1 })
          .eq("id", orderData.cupomId);
      }

      logStep("Coupon usage registered and counter incremented", { cupomId: orderData.cupomId });
    }

    // Registrar uso da fidelidade se aplicável
    if (orderData.fidelidadeId && orderData.pontosUsados) {
      logStep("Processing loyalty points", { 
        fidelidadeId: orderData.fidelidadeId, 
        pontosUsados: orderData.pontosUsados 
      });

      // Buscar pontos atuais
      const { data: fidelidade } = await supabase
        .from("fidelidade_pontos")
        .select("saldo_pontos")
        .eq("id", orderData.fidelidadeId)
        .single();

      if (fidelidade) {
        const novosPontos = (fidelidade.saldo_pontos || 0) - parseInt(orderData.pontosUsados);
        
        // Decrementar pontos
        await supabase
          .from("fidelidade_pontos")
          .update({ saldo_pontos: Math.max(0, novosPontos) })
          .eq("id", orderData.fidelidadeId);

        // Registrar transação
        await supabase.from("fidelidade_transacoes").insert({
          fidelidade_id: orderData.fidelidadeId,
          pedido_delivery_id: pedido.id,
          pontos: -parseInt(orderData.pontosUsados),
          descricao: `Resgate de R$ ${parseFloat(orderData.valorRecompensa || 0).toFixed(2)} no pedido`,
        });

        logStep("Loyalty points deducted", { 
          pontosUsados: orderData.pontosUsados,
          valorRecompensa: orderData.valorRecompensa 
        });
      }
    }

    // NOVO: Acumular pontos de fidelidade após compra (quando não resgatou pontos)
    if (orderData.empresaId && orderData.userId && !orderData.pontosUsados) {
      try {
        // Buscar config de fidelidade da empresa
        const { data: fidelidadeConfig } = await supabase
          .from("fidelidade_config")
          .select("*")
          .eq("empresa_id", orderData.empresaId)
          .eq("ativo", true)
          .maybeSingle();

        if (fidelidadeConfig && fidelidadeConfig.pontos_por_real > 0) {
          const pontosGanhos = Math.floor(parseFloat(orderData.subtotal) * fidelidadeConfig.pontos_por_real);
          
          if (pontosGanhos > 0) {
            // Buscar ou criar registro de pontos do usuário
            const { data: existingPontos } = await supabase
              .from("fidelidade_pontos")
              .select("id, pontos, saldo_pontos")
              .eq("user_id", orderData.userId)
              .eq("empresa_id", orderData.empresaId)
              .maybeSingle();

            if (existingPontos) {
              // Atualizar pontos existentes
              const novosPontos = (existingPontos.pontos || existingPontos.saldo_pontos || 0) + pontosGanhos;
              await supabase
                .from("fidelidade_pontos")
                .update({ 
                  pontos: novosPontos, 
                  saldo_pontos: novosPontos,
                  updated_at: new Date().toISOString() 
                })
                .eq("id", existingPontos.id);

              // Registrar transação de acúmulo
              await supabase.from("fidelidade_transacoes").insert({
                fidelidade_id: existingPontos.id,
                pedido_delivery_id: pedido.id,
                pontos: pontosGanhos,
                descricao: `+${pontosGanhos} pontos pela compra de R$ ${parseFloat(orderData.subtotal).toFixed(2)}`,
              });

              logStep("Loyalty points accumulated", { 
                pontosGanhos, 
                novoTotal: novosPontos,
                fidelidadeId: existingPontos.id
              });
            } else {
              // Criar novo registro de fidelidade
              const { data: novaFidelidade, error: fidErr } = await supabase
                .from("fidelidade_pontos")
                .insert({
                  user_id: orderData.userId,
                  empresa_id: orderData.empresaId,
                  pontos: pontosGanhos,
                  saldo_pontos: pontosGanhos,
                })
                .select("id")
                .single();

              if (!fidErr && novaFidelidade) {
                // Registrar transação inicial
                await supabase.from("fidelidade_transacoes").insert({
                  fidelidade_id: novaFidelidade.id,
                  pedido_delivery_id: pedido.id,
                  pontos: pontosGanhos,
                  descricao: `+${pontosGanhos} pontos pela primeira compra`,
                });

                logStep("New loyalty account created with points", { 
                  pontosGanhos,
                  fidelidadeId: novaFidelidade.id
                });
              }
            }
          }
        }
      } catch (loyaltyErr) {
        // Não falhar o pedido por erro de fidelidade - apenas logar
        logStep("Warning: Failed to accumulate loyalty points", { error: String(loyaltyErr) });
      }
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
