import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: { env: { get(name: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-SUBSCRIPTION-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }

    const { sessionId } = await req.json();
    logStep("Verificando sessionId", { sessionId });

    if (!sessionId) {
      throw new Error("sessionId é obrigatório");
    }

    // Buscar sessão no Stripe
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Erro ao buscar sessão no Stripe');
    }

    const session = await response.json();
    logStep("Sessão encontrada", { 
      id: session.id, 
      status: session.status,
      payment_status: session.payment_status,
      customer: session.customer,
      subscription: session.subscription,
      metadata: session.metadata
    });

    // Verificar se o pagamento foi bem sucedido
    const isPaymentSuccessful = session.payment_status === 'paid' || 
                                 session.status === 'complete' ||
                                 session.payment_status === 'no_payment_required'; // Para trial

    if (!isPaymentSuccessful) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Pagamento não confirmado',
        status: session.status,
        payment_status: session.payment_status
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrair metadados
    const planoId = session.metadata?.plano_id;
    const periodo = session.metadata?.periodo || 'mensal';
    const empresaId = session.metadata?.empresa_id || null;

    logStep("Pagamento confirmado", { 
      planoId, 
      periodo, 
      empresaId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription
    });

    return new Response(JSON.stringify({ 
      success: true,
      sessionId: session.id,
      planoId,
      periodo,
      empresaId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      customerEmail: session.customer_details?.email
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("ERRO", { message: error.message });
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
