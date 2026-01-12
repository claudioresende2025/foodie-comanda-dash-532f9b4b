import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Evitar uso do SDK do Stripe (esm.sh) para não depender de shims Node
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { orderId, total: clientTotal } = await req.json();
    console.log(`[VERIFY-PAYMENT] Recebido pedido: ${orderId} com total: ${clientTotal}`);

    // Verificar variáveis de ambiente
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) {
      console.error("[VERIFY-PAYMENT] ERRO: STRIPE_SECRET_KEY não encontrada!");
      throw new Error("Configuração do servidor incompleta.");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[VERIFY-PAYMENT] ERRO: Supabase credentials não encontradas!");
      throw new Error("Configuração do Supabase não encontrada.");
    }

    const stripeSecret = stripeKey;

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

    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // VALIDAÇÃO SERVER-SIDE: Buscar pedido do banco de dados
    console.log(`[VERIFY-PAYMENT] Validating order from database: ${orderId}`);
    
    const { data: order, error: orderError } = await supabase
      .from('pedidos_delivery')
      .select(`
        id,
        total,
        subtotal,
        taxa_entrega,
        status,
        items_delivery (
          id,
          quantidade,
          preco_unitario,
          subtotal
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error("[VERIFY-PAYMENT] Pedido não encontrado:", orderError);
      throw new Error("Pedido não encontrado no banco de dados.");
    }

    // Verificar se já foi pago
    if (order.status === 'pago' || order.status === 'confirmado') {
      console.error(`[VERIFY-PAYMENT] Pedido já foi pago. Status: ${order.status}`);
      throw new Error("Este pedido já foi pago.");
    }

    // Calcular e validar total
    const itemsTotal = order.items_delivery?.reduce((sum: number, item: any) => 
      sum + (item.quantidade * item.preco_unitario), 0) || 0;
    
    const expectedTotal = itemsTotal + (order.taxa_entrega || 0);
    const tolerance = 0.01;

    console.log("[VERIFY-PAYMENT] Validação de totais:", {
      clientTotal,
      dbTotal: order.total,
      calculatedTotal: expectedTotal,
      itemsTotal,
      taxaEntrega: order.taxa_entrega
    });

    // VALIDAÇÃO CRÍTICA
    if (Math.abs(order.total - expectedTotal) > tolerance) {
      console.error("[VERIFY-PAYMENT] Inconsistência DB vs calculated");
      throw new Error("Inconsistência nos valores do pedido.");
    }

    if (clientTotal !== undefined && Math.abs(clientTotal - order.total) > tolerance) {
      console.error("[VERIFY-PAYMENT] Total do cliente diferente do banco");
      throw new Error("O valor do pedido foi alterado. Atualize a página e tente novamente.");
    }

    // Usar total validado do banco
    const validatedTotal = order.total;
    console.log(`[VERIFY-PAYMENT] Total validado: R$ ${validatedTotal}`);

    const sessionPayload: any = {
      mode: 'payment',
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][product_data][name]': `Pedido #${orderId.slice(0,8)}`,
      'line_items[0][price_data][unit_amount]': String(Math.round(validatedTotal * 100)),
      'line_items[0][quantity]': '1',
      success_url: `${req.headers.get('origin')}/delivery?success=true`,
      cancel_url: `${req.headers.get('origin')}/delivery?canceled=true`,
    };
    sessionPayload['metadata[orderId]'] = orderId;
    sessionPayload['metadata[validatedTotal]'] = validatedTotal.toString();

    const session = await stripeRequest('checkout/sessions', 'POST', sessionPayload);

    console.log("Sessão do Stripe criada com sucesso!");
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro detalhado da função:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
