import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Evitar uso do SDK do Stripe (esm.sh) para não depender de shims Node
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

const buildCors = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

serve(async (req: Request) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl) {
      return new Response(JSON.stringify({ error: "SUPABASE_URL não configurado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Credencial do Supabase não configurada. Configure SUPABASE_SERVICE_ROLE_KEY nos secrets para processar reembolsos.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!bearerToken || bearerToken.length < 10) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let bodyObj: any = null;
    if (contentType.includes("application/json")) {
      try {
        bodyObj = await req.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "JSON inválido", details: getErrorMessage(e) }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      try {
        const raw = await req.text();
        bodyObj = raw ? JSON.parse(raw) : null;
      } catch {
        return new Response(JSON.stringify({ error: "Corpo inválido. Envie JSON válido." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { 
      tipo, // 'pedido' ou 'assinatura'
      pedidoId,
      assinaturaId,
      motivo,
      valorParcial, // Se quiser reembolso parcial
    } = bodyObj || {};

    if (!tipo || (!pedidoId && !assinaturaId)) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tipo !== "pedido" && tipo !== "assinatura") {
      return new Response(JSON.stringify({ error: "Tipo de reembolso inválido" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      empresaId = pedido.empresa_id;
      const totalPedido = Number(pedido.total) || 0;
      if (valorParcial !== undefined && valorParcial !== null) {
        const vp = Number(valorParcial);
        if (!Number.isFinite(vp) || vp <= 0 || vp > totalPedido) {
          return new Response(JSON.stringify({ error: "Valor parcial inválido" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        valor = Math.round(vp * 100) / 100;
      } else {
        valor = totalPedido;
      }
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
        return new Response(JSON.stringify({ error: "Sem permissão para solicitar reembolso" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar se pedido pode ser reembolsado (não pode estar entregue há mais de 24h)
      if (pedido.status === 'entregue') {
        const entregueAt = new Date(pedido.updated_at);
        const horasDesdeEntrega = (Date.now() - entregueAt.getTime()) / (1000 * 60 * 60);
        if (horasDesdeEntrega > 24) {
          return new Response(
            JSON.stringify({ error: "Prazo para reembolso expirado (24 horas após entrega)" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
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
        return new Response(JSON.stringify({ error: "Assinatura não encontrada" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        return new Response(JSON.stringify({ error: "Nenhum pagamento encontrado para reembolso" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      valor = valorParcial || ultimoPagamento.valor;
      stripePaymentIntentId = ultimoPagamento.stripe_payment_intent_id;
      metodoOriginal = ultimoPagamento.metodo_pagamento;

      const valorMaximo = Number(ultimoPagamento.valor) || 0;
      if (valorParcial !== undefined && valorParcial !== null) {
        const vp = Number(valorParcial);
        if (!Number.isFinite(vp) || vp <= 0 || vp > valorMaximo) {
          return new Response(JSON.stringify({ error: "Valor parcial inválido" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        valor = Math.round(vp * 100) / 100;
      } else {
        valor = valorMaximo;
      }

      // Verificar se usuário é dono da empresa
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (profile?.empresa_id !== empresaId) {
        return new Response(JSON.stringify({ error: "Sem permissão para solicitar reembolso" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar política de reembolso (ex: dentro de 7 dias do pagamento)
      const pagamentoAt = new Date(ultimoPagamento.created_at);
      const diasDesdePagamento = (Date.now() - pagamentoAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diasDesdePagamento > 7) {
        return new Response(
          JSON.stringify({ error: "Prazo para reembolso expirado (7 dias após pagamento)" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

    } else {
      return new Response(JSON.stringify({ error: "Tipo de reembolso inválido" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se já existe reembolso pendente
    const { data: reembolsoExistente } = await supabase
      .from("reembolsos")
      .select("id")
      .eq(tipo === 'pedido' ? "pedido_delivery_id" : "assinatura_id", tipo === 'pedido' ? pedidoId : assinaturaId)
      .in("status", ["pending", "processing"])
      .single();

    if (reembolsoExistente) {
      return new Response(JSON.stringify({ error: "Já existe uma solicitação de reembolso pendente" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        motivo: typeof motivo === "string" ? (motivo.length > 255 ? motivo.slice(0, 255) : motivo) : "Solicitado pelo usuário",
        status: "pending",
        metodo_original: metodoOriginal,
      })
      .select()
      .single();

    if (reembolsoError) {
      return new Response(JSON.stringify({ error: "Erro ao criar solicitação de reembolso" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se for pagamento via Stripe e temos o payment_intent, processar automaticamente
    if (stripeSecretKey && stripePaymentIntentId && metodoOriginal === 'card') {
      try {
        const stripeSecret = stripeSecretKey;
        const stripeRequest = async (path: string, method = 'GET', body?: Record<string, any>, idempotencyKey?: string) => {
          const url = `https://api.stripe.com/v1/${path}`;
          const headers: Record<string,string> = {
            Authorization: `Bearer ${stripeSecret}`,
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          };
          if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
          }
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
          amount: Math.max(1, Math.round(valor * 100)),
          reason: 'requested_by_customer',
          metadata: { reembolso_id: reembolso.id, tipo, empresa_id: empresaId }
        }, `refund_${reembolso.id}`);

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

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Reembolso processado automaticamente',
            reembolso: { ...reembolso, status: refund.status },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );

      } catch (stripeError: any) {
        console.error('Erro no Stripe:', stripeError);
        // Manter como pendente para processamento manual
        return new Response(
          JSON.stringify({ success: true, message: 'Solicitação registrada. Será processada manualmente.', reembolso }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro no reembolso:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || "Erro inesperado" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
