import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_SEQUENCE: { day: number; template: string }[] = [
  { day: 0, template: "trial_welcome" },
  { day: 3, template: "trial_tip_cardapio" },
  { day: 7, template: "trial_midpoint" },
  { day: 11, template: "trial_urgency" },
  { day: 14, template: "trial_expired" },
  { day: 21, template: "trial_reengagement" },
];

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[TRIAL-EMAIL-SEQ] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all trial subscriptions
    const { data: assinaturas, error: assError } = await supabase
      .from("assinaturas")
      .select("id, empresa_id, data_inicio, trial_emails_sent, status")
      .in("status", ["trial", "trialing"]);

    if (assError) {
      logStep("ERROR fetching assinaturas", assError);
      return new Response(JSON.stringify({ success: false, error: assError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found trial subscriptions", { count: assinaturas?.length || 0 });

    let emailsSent = 0;
    let errors = 0;

    for (const ass of assinaturas || []) {
      const startDate = new Date(ass.data_inicio);
      const now = new Date();
      const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const sentEmails: string[] = Array.isArray(ass.trial_emails_sent) ? ass.trial_emails_sent : [];

      // Find which email to send (check from latest to earliest)
      for (const step of EMAIL_SEQUENCE) {
        if (daysSinceStart >= step.day && !sentEmails.includes(step.template)) {
          // Get user email via profiles joined through empresa_id
          const { data: profiles } = await supabase
            .from("profiles")
            .select("email, nome")
            .eq("empresa_id", ass.empresa_id)
            .limit(1);

          const profile = profiles?.[0];
          if (!profile?.email) {
            logStep("No profile found for empresa", { empresa_id: ass.empresa_id });
            continue;
          }

          // Send email via send-email function
          try {
            const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
            const res = await fetch(sendEmailUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                type: step.template,
                to: profile.email,
                data: { nome: profile.nome },
              }),
            });

            if (res.ok) {
              // Update trial_emails_sent
              const updatedSent = [...sentEmails, step.template];
              await supabase
                .from("assinaturas")
                .update({ trial_emails_sent: updatedSent })
                .eq("id", ass.id);

              emailsSent++;
              logStep("Email sent", { template: step.template, to: profile.email, day: step.day });
            } else {
              const errBody = await res.text();
              logStep("ERROR sending email", { template: step.template, status: res.status, body: errBody });
              errors++;
            }
          } catch (e: any) {
            logStep("ERROR calling send-email", { message: e.message });
            errors++;
          }

          // Only send one email per subscription per run
          break;
        }
      }
    }

    logStep("Finished", { emailsSent, errors });

    return new Response(
      JSON.stringify({ success: true, emailsSent, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
