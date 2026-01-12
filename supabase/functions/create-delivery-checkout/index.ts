import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Evitar uso do SDK do Stripe (esm.sh) para não depender de shims Node
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
      return new Response(
        JSON.stringify({ 
          error: "Sistema de pagamento não configurado. Por favor, entre em contato com o restaurante.",
          details: "STRIPE_SECRET_KEY não encontrada"
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503,
        }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      logStep("ERROR: Supabase credentials not found");
      return new Response(
        JSON.stringify({ 
          error: "Erro de configuração do servidor.",
          details: "Credenciais do Supabase não encontradas"
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503,
        }
      );
    }

    logStep("Stripe key verified");
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

    const sessionPayload: any = {
      mode: 'payment',
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][product_data][name]': `Pedido Delivery - ${orderData.empresaNome || 'Restaurante'}`,
      'line_items[0][price_data][product_data][description]': 'Pagamento do seu pedido no Delivery',
      'line_items[0][price_data][unit_amount]': String(Math.round(validatedTotal * 100)),
      'line_items[0][quantity]': '1',
      success_url: `${origin}/delivery/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/delivery?canceled=true`,
    };

    // metadata
    const meta = {
      empresaId: orderData.empresaId,
      enderecoId: orderData.enderecoId,
      userId: orderData.userId,
      subtotal: orderData.subtotal?.toString?.() || '',
      taxaEntrega: orderData.taxaEntrega?.toString?.() || '0',
      desconto: orderData.desconto?.toString?.() || '0',
      descontoCupom: orderData.descontoCupom?.toString?.() || '0',
      descontoFidelidade: orderData.descontoFidelidade?.toString?.() || '0',
      total: validatedTotal.toString(),
      cupomId: orderData.cupomId || '',
      fidelidadeId: orderData.fidelidadeId || '',
      pontosUsados: orderData.pontosUsados?.toString?.() || '',
      valorRecompensa: orderData.valorRecompensa?.toString?.() || '',
      notas: orderData.notas || '',
      items: JSON.stringify(orderData.items || []),
    };
    for (const k of Object.keys(meta)) {
      sessionPayload[`metadata[${k}]`] = meta[k];
    }

    const session = await stripeRequest('checkout/sessions', 'POST', sessionPayload);

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
