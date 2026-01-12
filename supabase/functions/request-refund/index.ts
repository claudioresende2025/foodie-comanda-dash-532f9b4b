import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Evitar uso do SDK do Stripe (esm.sh) para não depender de shims Node
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Não autorizado");
    }

    const { 
      tipo, // 'pedido' ou 'assinatura'
      pedidoId,
      assinaturaId,
      motivo,
      valorParcial, // Se quiser reembolso parcial
    } = await req.json();

    if (!tipo || (!pedidoId && !assinaturaId)) {
      throw new Error("Parâmetros inválidos");
    }

    let empresaId: string;
    let valor: number;
    let stripePaymentIntentId: string | null = null;
    let metodoOriginal: string | null = null;

    // Verificar permissões e buscar dados
    if (tipo === 'pedido') {
      // Reembolso de pedido delivery
      const { data: pedido, error } = await supabase
        .from("pedidos_delivery")
        .select("*, empresa:empresas(id)")
        .eq("id", pedidoId)
        .single();

      if (error || !pedido) {
        throw new Error("Pedido não encontrado");
      }

      empresaId = pedido.empresa_id;
      valor = valorParcial || pedido.total;
      stripePaymentIntentId = pedido.stripe_payment_intent_id;
      metodoOriginal = pedido.metodo_pagamento;

      // Verificar se usuário tem permissão (dono da empresa ou o próprio cliente)
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      const isOwner = profile?.empresa_id === empresaId;
      const isCustomer = pedido.user_id === user.id;

      if (!isOwner && !isCustomer) {
        throw new Error("Sem permissão para solicitar reembolso");
      }

      // Verificar se pedido pode ser reembolsado (não pode estar entregue há mais de 24h)
      if (pedido.status === 'entregue') {
        const entregueAt = new Date(pedido.updated_at);
        const horasDesdeEntrega = (Date.now() - entregueAt.getTime()) / (1000 * 60 * 60);
        if (horasDesdeEntrega > 24) {
          throw new Error("Prazo para reembolso expirado (24 horas após entrega)");
        }
      }

    } else if (tipo === 'assinatura') {
      // Reembolso de assinatura
      const { data: assinatura, error } = await supabase
        .from("assinaturas")
        .select("*, empresa:empresas(*)")
        .eq("id", assinaturaId)
        .single();

      if (error || !assinatura) {
        throw new Error("Assinatura não encontrada");
      }

      empresaId = assinatura.empresa_id;

      // Buscar último pagamento
      const { data: ultimoPagamento } = await supabase
        .from("pagamentos_assinatura")
        .select("*")
        .eq("assinatura_id", assinaturaId)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!ultimoPagamento) {
        throw new Error("Nenhum pagamento encontrado para reembolso");
      }

      valor = valorParcial || ultimoPagamento.valor;
      stripePaymentIntentId = ultimoPagamento.stripe_payment_intent_id;
      metodoOriginal = ultimoPagamento.metodo_pagamento;

      // Verificar se usuário é dono da empresa
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (profile?.empresa_id !== empresaId) {
        throw new Error("Sem permissão para solicitar reembolso");
      }

      // Verificar política de reembolso (ex: dentro de 7 dias do pagamento)
      const pagamentoAt = new Date(ultimoPagamento.created_at);
      const diasDesdePagamento = (Date.now() - pagamentoAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diasDesdePagamento > 7) {
        throw new Error("Prazo para reembolso expirado (7 dias após pagamento)");
      }

    } else {
      throw new Error("Tipo de reembolso inválido");
    }

    // Verificar se já existe reembolso pendente
    const { data: reembolsoExistente } = await supabase
      .from("reembolsos")
      .select("id")
      .eq(tipo === 'pedido' ? "pedido_delivery_id" : "assinatura_id", tipo === 'pedido' ? pedidoId : assinaturaId)
      .in("status", ["pending", "processing"])
      .single();

    if (reembolsoExistente) {
      throw new Error("Já existe uma solicitação de reembolso pendente");
    }

    // Criar solicitação de reembolso
    const { data: reembolso, error: reembolsoError } = await supabase
      .from("reembolsos")
      .insert({
        empresa_id: empresaId,
        pedido_delivery_id: tipo === 'pedido' ? pedidoId : null,
        assinatura_id: tipo === 'assinatura' ? assinaturaId : null,
        tipo,
        valor,
        motivo: motivo || "Solicitado pelo usuário",
        status: "pending",
        metodo_original: metodoOriginal,
      })
      .select()
      .single();

    if (reembolsoError) {
      throw new Error("Erro ao criar solicitação de reembolso");
    }

    // Se for pagamento via Stripe e temos o payment_intent, processar automaticamente
    if (stripeSecretKey && stripePaymentIntentId && metodoOriginal === 'card') {
      try {
        const stripeSecret = stripeSecretKey;
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

        // Criar reembolso via a API REST do Stripe
        const refund = await stripeRequest('refunds', 'POST', {
          payment_intent: stripePaymentIntentId,
          amount: Math.round(valor * 100),
          reason: 'requested_by_customer',
          metadata: { reembolso_id: reembolso.id, tipo, empresa_id: empresaId }
        });

        // Atualizar status do reembolso
        await supabase
          .from('reembolsos')
          .update({
            status: refund.status === 'succeeded' ? 'succeeded' : 'processing',
            stripe_refund_id: refund.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reembolso.id);

        // Se for reembolso de pedido, atualizar status do pedido
        if (tipo === 'pedido' && refund.status === 'succeeded') {
          await supabase
            .from('pedidos_delivery')
            .update({ status: 'cancelado' })
            .eq('id', pedidoId);
        }

        // Se for reembolso de assinatura, cancelar assinatura
        if (tipo === 'assinatura' && refund.status === 'succeeded') {
          // Buscar subscription_id
          const { data: assinatura } = await supabase
            .from('assinaturas')
            .select('stripe_subscription_id')
            .eq('id', assinaturaId)
            .single();

          if (assinatura?.stripe_subscription_id) {
            try {
              await stripeRequest(`subscriptions/${assinatura.stripe_subscription_id}/cancel`, 'POST');
            } catch (e) {
              console.warn('Erro ao cancelar subscription via Stripe API:', e);
            }
          }

          await supabase
            .from('assinaturas')
            .update({ status: 'canceled', canceled_at: new Date().toISOString() })
            .eq('id', assinaturaId);
        }

        return new Response(JSON.stringify({ success: true, message: 'Reembolso processado automaticamente', reembolso: { ...reembolso, status: refund.status } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      } catch (stripeError: any) {
        console.error('Erro no Stripe:', stripeError);
        // Manter como pendente para processamento manual
        return new Response(JSON.stringify({ success: true, message: 'Solicitação registrada. Será processada manualmente.', reembolso }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Para PIX ou quando Stripe não está configurado, reembolso manual
    return new Response(
      JSON.stringify({
        success: true,
        message: metodoOriginal === 'pix' 
          ? "Solicitação registrada. O reembolso via PIX será processado em até 5 dias úteis."
          : "Solicitação registrada para análise.",
        reembolso,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro no reembolso:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
