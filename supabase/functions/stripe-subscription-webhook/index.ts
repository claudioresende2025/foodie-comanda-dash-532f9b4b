import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Função Robusta para verificar assinatura no Edge Runtime
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string) {
  const encoder = new TextEncoder();
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const { t, v1 } = parts;
  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return signatureHex === v1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // IMPORTANTE: Ler o corpo como texto ANTES de qualquer processamento
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event;

    if (stripeWebhookSecret && signature) {
      const isValid = await verifyStripeSignature(body, signature, stripeWebhookSecret);
      if (!isValid) {
        console.error("Assinatura do webhook inválida");
        // Log de erro no banco para depuração
        const debugPayload = (() => { try { return JSON.parse(body); } catch { return { raw: body }; } })();
        await supabase.from('webhook_logs').insert({ 
          event: 'invalid_signature', 
          payload: debugPayload 
        });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
      event = JSON.parse(body);
    } else {
      event = JSON.parse(body);
    }

    console.log("Evento processado:", event.type);

    // ... (Mantenha aqui o restante dos seus Handlers: checkout.session.completed, etc.)
    // O restante do seu código original (os switch cases) pode ser colado aqui.

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro crítico no webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
