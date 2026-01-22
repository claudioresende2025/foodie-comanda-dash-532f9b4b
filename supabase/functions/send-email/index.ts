import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'welcome' | 'subscription_confirmed' | 'trial_reminder' | 'password_reset' | 'payment_receipt';
  to: string;
  data: Record<string, any>;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-EMAIL] ${step}${detailsStr}`);
};

// Templates de e-mail em HTML
const templates: Record<string, (data: any) => { subject: string; html: string }> = {
  welcome: (data) => ({
    subject: `Bem-vindo ao Foodie Comanda Pro, ${data.nome}!`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Bem-vindo ao Foodie Comanda Pro!</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome}</strong>,</p>
            
            <p style="font-size: 16px;">Seu cadastro foi realizado com sucesso! Você tem <strong>${data.trialDays || 3} dias de teste gratuito</strong> para explorar todas as funcionalidades.</p>
            
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #16a34a;">
              <h3 style="margin-top: 0; color: #166534;">🚀 Próximos passos:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Configure seu cardápio digital</li>
                <li style="margin-bottom: 8px;">Cadastre suas mesas</li>
                <li style="margin-bottom: 8px;">Convide sua equipe</li>
                <li>Configure o delivery</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.loginUrl || 'https://foodie-comanda-dash.lovable.app/admin'}" 
                 style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Acessar Meu Painel
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              Precisa de ajuda? Responda este e-mail ou acesse nosso suporte.
            </p>
          </div>
          
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
            © ${new Date().getFullYear()} Foodie Comanda Pro. Todos os direitos reservados.
          </p>
        </div>
      </body>
      </html>
    `
  }),
  
  subscription_confirmed: (data) => ({
    subject: `✅ Assinatura Confirmada - Plano ${data.plano}`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Assinatura Confirmada</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✅ Pagamento Confirmado!</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            
            <p style="font-size: 16px;">Sua assinatura do plano <strong>${data.plano}</strong> foi ativada com sucesso!</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Plano:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${data.plano}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Valor:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${data.valor}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Próxima cobrança:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${data.proximaCobranca}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.dashboardUrl || 'https://foodie-comanda-dash.lovable.app/admin'}" 
                 style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Ir para o Painel
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              Dúvidas sobre sua assinatura? Entre em contato conosco.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),
  
  trial_reminder: (data) => ({
    subject: `⚠️ Seu período de teste termina em ${data.diasRestantes} dia(s)`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lembrete de Trial</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">⏰ Seu teste está acabando!</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            
            <p style="font-size: 16px;">Seu período de teste do Foodie Comanda Pro termina em <strong>${data.dataFim}</strong>.</p>
            
            <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #b45309; margin: 0;">
                ${data.diasRestantes} ${data.diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
              </p>
            </div>
            
            <p style="font-size: 16px;">Para continuar usando todas as funcionalidades, escolha um plano que atenda suas necessidades.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.planosUrl || 'https://foodie-comanda-dash.lovable.app/planos'}" 
                 style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Ver Planos Disponíveis
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),
  
  password_reset: (data) => ({
    subject: '🔐 Redefinição de Senha - Foodie Comanda Pro',
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinição de Senha</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Redefinição de Senha</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá,</p>
            
            <p style="font-size: 16px;">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.resetUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Redefinir Minha Senha
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">Este link expira em 1 hora. Se você não solicitou esta redefinição, ignore este e-mail.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            
            <p style="color: #9ca3af; font-size: 12px;">
              Se o botão não funcionar, copie e cole este link no seu navegador:<br>
              <a href="${data.resetUrl}" style="color: #3b82f6; word-break: break-all;">${data.resetUrl}</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),
  
  payment_receipt: (data) => ({
    subject: `🧾 Recibo de Pagamento - ${data.valor}`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recibo de Pagamento</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🧾 Recibo de Pagamento</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            
            <p style="font-size: 16px;">Confirmamos o recebimento do seu pagamento:</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Descrição:</td>
                  <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">${data.descricao || 'Assinatura'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Data:</td>
                  <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">${data.data}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Método:</td>
                  <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">${data.metodo || 'Cartão de Crédito'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; font-size: 18px;">Total:</td>
                  <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 18px; color: #16a34a;">${data.valor}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              Guarde este e-mail como comprovante de pagamento.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      logStep("ERROR: RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Serviço de e-mail não configurado. Configure a API key do Resend." 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { type, to, data }: EmailRequest = await req.json();
    logStep("Request received", { type, to });
    
    if (!type || !to) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros 'type' e 'to' são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (!templates[type]) {
      return new Response(
        JSON.stringify({ success: false, error: `Template "${type}" não encontrado` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const template = templates[type](data || {});
    logStep("Template generated", { subject: template.subject });
    
    // Usar domínio padrão do Resend para testes (onboarding@resend.dev)
    // Em produção, substituir por domínio verificado
    const fromEmail = Deno.env.get("EMAIL_FROM") || "Foodie Comanda <onboarding@resend.dev>";
    
    // Enviar via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: template.subject,
        html: template.html,
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      logStep("ERROR: Resend API error", result);
      return new Response(
        JSON.stringify({ success: false, error: result.message || "Erro ao enviar e-mail" }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    logStep("Email sent successfully", { id: result.id, to });

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
