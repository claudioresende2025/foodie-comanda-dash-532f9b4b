import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  empresa_id: string;
  title: string;
  body: string;
  type?: 'admin' | 'delivery';
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PUSH-NOTIFICATION] ${step}${detailsStr}`);
};

// Web Push utilities usando crypto nativo do Deno
async function generateJWT(claims: Record<string, unknown>, privateKeyBase64: string): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  
  const encode = (obj: unknown) => 
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const headerB64 = encode(header);
  const claimsB64 = encode(claims);
  const unsignedToken = `${headerB64}.${claimsB64}`;
  
  // Import private key
  const privateKeyBuffer = Uint8Array.from(atob(privateKeyBase64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return `${unsignedToken}.${signatureB64}`;
}

async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    
    // Create VAPID JWT
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      aud: audience,
      exp: now + 12 * 60 * 60, // 12 hours
      sub: "mailto:contato@foodcomandapro.com.br"
    };
    
    // For ES256, we need the private key in proper format
    // The web-push generated key is raw, we need to convert it
    const jwt = await generateJWT(claims, vapidPrivateKey);
    
    const vapidAuth = `vapid t=${jwt}, k=${vapidPublicKey}`;
    
    // Encrypt payload using Web Push encryption
    // For simplicity, we'll send unencrypted for now and add encryption later
    // In production, proper aesgcm encryption should be implemented
    
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": vapidAuth,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Urgency": "high",
      },
      body: payload,
    });
    
    if (response.status === 201 || response.status === 200) {
      return { success: true, statusCode: response.status };
    }
    
    // Handle specific error codes
    if (response.status === 410 || response.status === 404) {
      // Subscription expired or invalid - should be deleted
      return { success: false, statusCode: response.status, error: "subscription_expired" };
    }
    
    const errorText = await response.text();
    return { success: false, statusCode: response.status, error: errorText };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Get secrets
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("Missing VAPID keys configuration. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.");
    }

    // Parse request body
    const body: PushNotificationRequest = await req.json();
    logStep("Request received", { empresa_id: body.empresa_id, title: body.title, type: body.type });

    if (!body.empresa_id || !body.title || !body.body) {
      throw new Error("Missing required fields: empresa_id, title, body");
    }

    // Create Supabase client with service role (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all admin subscriptions for this empresa
    const subscriptionType = body.type || 'admin';
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("empresa_id", body.empresa_id)
      .eq("type", subscriptionType);

    if (fetchError) {
      logStep("Error fetching subscriptions", { error: fetchError.message });
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No subscriptions found for empresa", { empresa_id: body.empresa_id });
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No subscriptions to notify",
          sent: 0 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    logStep("Found subscriptions", { count: subscriptions.length });

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: body.title,
      body: body.body,
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      tag: body.tag || `notification-${Date.now()}`,
      data: {
        url: body.url || "/admin",
        ...body.data
      },
      requireInteraction: true,
      actions: [
        { action: "open", title: "Abrir" },
        { action: "dismiss", title: "Dispensar" }
      ]
    });

    // Send push to all subscriptions
    const results = {
      sent: 0,
      failed: 0,
      expired: [] as string[]
    };

    for (const subscription of subscriptions) {
      const result = await sendWebPush(
        subscription,
        notificationPayload,
        vapidPublicKey,
        vapidPrivateKey
      );

      if (result.success) {
        results.sent++;
        logStep("Push sent successfully", { endpoint: subscription.endpoint.substring(0, 50) });
      } else {
        results.failed++;
        logStep("Push failed", { 
          endpoint: subscription.endpoint.substring(0, 50),
          error: result.error,
          statusCode: result.statusCode
        });

        // Delete expired subscriptions
        if (result.error === "subscription_expired") {
          results.expired.push(subscription.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (results.expired.length > 0) {
      const { error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", results.expired);

      if (deleteError) {
        logStep("Error deleting expired subscriptions", { error: deleteError.message });
      } else {
        logStep("Deleted expired subscriptions", { count: results.expired.length });
      }
    }

    logStep("Notifications complete", results);

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: results.sent,
        failed: results.failed,
        expired: results.expired.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error", { error: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
