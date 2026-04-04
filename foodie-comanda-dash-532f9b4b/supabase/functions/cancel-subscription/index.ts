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

const buildCors = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req: Request) => {
  const corsHeaders = buildCors(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
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

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "STRIPE_SECRET_KEY não configurada",
          message: "Configure a chave do Stripe nos secrets para processar cancelamentos.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Autenticação
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

    logStep("User authenticated", { userId: user.id });

    // Parsear body
    let bodyObj: any = null;
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
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
      subscriptionId, 
      cancelAtPeriodEnd = true,
      cancelImmediately = false,
      empresaId,
    } = bodyObj || {};

    logStep("Request params", { subscriptionId, cancelAtPeriodEnd, cancelImmediately, empresaId });

    // Verificar permissões
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", user.id)
      .single();

    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar assinatura
    const { data: assinatura, error: assinaturaError } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("empresa_id", profile.empresa_id)
      .single();

    if (assinaturaError || !assinatura) {
      return new Response(JSON.stringify({ error: "Assinatura não encontrada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Subscription found", { 
      id: assinatura.id, 
      status: assinatura.status,
      stripeId: assinatura.stripe_subscription_id 
    });

    // Função para chamar API do Stripe
    const stripeRequest = async (path: string, method = 'GET', body?: Record<string, any>) => {
      const url = `https://api.stripe.com/v1/${path}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${stripeSecretKey}`,
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

    // Se tem stripe_subscription_id, cancelar via Stripe
    const stripeSubId = subscriptionId || assinatura.stripe_subscription_id;
    
    if (stripeSubId) {
      logStep("Canceling via Stripe", { stripeSubId, cancelImmediately, cancelAtPeriodEnd });
      
      try {
        if (cancelImmediately) {
          // Cancelar imediatamente (DELETE)
          await stripeRequest(`subscriptions/${stripeSubId}`, 'DELETE');
          logStep("Subscription deleted immediately");
        } else {
          // Agendar cancelamento no fim do período
          await stripeRequest(`subscriptions/${stripeSubId}`, 'POST', {
            cancel_at_period_end: true
          });
          logStep("Subscription scheduled for cancellation");
        }
      } catch (stripeError: any) {
        // Se o erro for "resource_missing", a assinatura já foi cancelada no Stripe
        if (stripeError.message?.includes('No such subscription') || 
            stripeError.message?.includes('resource_missing')) {
          logStep("Subscription already canceled in Stripe, updating local only");
        } else {
          console.error("Stripe error:", stripeError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Erro ao cancelar no Stripe",
              message: stripeError.message || "Tente novamente mais tarde"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Atualizar no banco de dados
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (cancelImmediately) {
      updatePayload.status = 'canceled';
      updatePayload.canceled_at = new Date().toISOString();
    } else {
      updatePayload.cancel_at_period_end = true;
    }

    const { error: updateError } = await supabase
      .from("assinaturas")
      .update(updatePayload)
      .eq("id", assinatura.id);

    if (updateError) {
      logStep("Error updating subscription", { error: updateError });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Erro ao atualizar assinatura no banco",
          details: updateError.message
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    logStep("Subscription updated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: cancelImmediately 
          ? "Assinatura cancelada com sucesso"
          : "Assinatura será cancelada ao fim do período atual",
        canceledImmediately: cancelImmediately,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: any) {
    console.error("Erro ao cancelar assinatura:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || "Erro inesperado" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
