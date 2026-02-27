import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'welcome' | 'subscription_confirmed' | 'trial_reminder' | 'password_reset' | 'payment_receipt' | 'trial_welcome' | 'trial_tip_cardapio' | 'trial_midpoint' | 'trial_urgency' | 'trial_expired' | 'trial_reengagement';
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
    subject: `Bem-vindo ao Food Comanda Pro, ${data.nome}!`,
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
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Bem-vindo ao Food Comanda Pro!</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome}</strong>,</p>
            
            <p style="font-size: 16px;">Seu cadastro foi realizado com sucesso! Você tem <strong>${data.trialDays || 14} dias de teste gratuito</strong> para explorar todas as funcionalidades.</p>
            
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
            © ${new Date().getFullYear()} Food Comanda Pro. Todos os direitos reservados.
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
            
            <p style="font-size: 16px;">Seu período de teste do Food Comanda Pro termina em <strong>${data.dataFim}</strong>.</p>
            
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
    subject: '🔐 Redefinição de Senha - Food Comanda Pro',
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
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
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
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Descrição:</td><td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">${data.descricao || 'Assinatura'}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Data:</td><td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">${data.data}</td></tr>
                <tr><td style="padding: 10px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Método:</td><td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">${data.metodo || 'Cartão de Crédito'}</td></tr>
                <tr><td style="padding: 10px 0; font-weight: bold; font-size: 18px;">Total:</td><td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 18px; color: #16a34a;">${data.valor}</td></tr>
              </table>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center;">Guarde este e-mail como comprovante de pagamento.</p>
          </div>
        </div>
      </body></html>
    `
  }),

  trial_welcome: (data) => ({
    subject: `🚀 Bem-vindo! Como começar em 5 minutos`,
    html: `
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🚀 Comece em 5 minutos!</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            <p style="font-size: 16px;">Bem-vindo ao Food Comanda Pro! Aqui estão 3 passos para começar agora:</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #16a34a;">
              <p style="margin: 0 0 12px 0;"><strong>1️⃣</strong> Cadastre seus produtos no cardápio digital</p>
              <p style="margin: 0 0 12px 0;"><strong>2️⃣</strong> Crie suas mesas e gere os QR Codes</p>
              <p style="margin: 0;"><strong>3️⃣</strong> Convide sua equipe (garçons, caixas)</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.loginUrl || 'https://foodie-comanda-dash.lovable.app/admin'}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Acessar Meu Painel</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center;">Precisa de ajuda? Responda este e-mail!</p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Food Comanda Pro</p>
        </div>
      </body></html>
    `
  }),

  trial_tip_cardapio: (data) => ({
    subject: `📋 Você já criou seu cardápio digital?`,
    html: `
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📋 Dica: Crie seu Cardápio</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            <p style="font-size: 16px;">Restaurantes que criam o cardápio digital nos primeiros 14 dias <strong>triplicam o engajamento</strong> com os clientes!</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #16a34a;">
              <h3 style="margin-top: 0; color: #166534;">✨ Como criar seu cardápio:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Acesse Cardápio no menu lateral</li>
                <li style="margin-bottom: 8px;">Crie categorias (Ex: Entradas, Pratos, Bebidas)</li>
                <li>Adicione seus produtos com fotos e preços</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.loginUrl || 'https://foodie-comanda-dash.lovable.app/admin/cardapio'}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Criar Cardápio Agora</a>
            </div>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Food Comanda Pro</p>
        </div>
      </body></html>
    `
  }),

  trial_midpoint: (data) => ({
    subject: `🏆 Metade do seu trial! Veja o que conquistou`,
    html: `
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🏆 Metade do Trial!</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            <p style="font-size: 16px;">Você já está na metade do seu período de teste! Aqui está o resumo:</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0 0 8px 0;">📊 <strong>${data.totalProdutos || 0}</strong> produtos cadastrados</p>
              <p style="margin: 0 0 8px 0;">🪑 <strong>${data.totalMesas || 0}</strong> mesas criadas</p>
              <p style="margin: 0;">👥 <strong>${data.totalEquipe || 0}</strong> membros na equipe</p>
            </div>
            <p style="font-size: 16px;">Continue explorando! Ainda faltam <strong>${data.diasRestantes || 7} dias</strong> de teste.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.loginUrl || 'https://foodie-comanda-dash.lovable.app/admin'}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Continuar Configurando</a>
            </div>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Food Comanda Pro</p>
        </div>
      </body></html>
    `
  }),

  trial_urgency: (data) => ({
    subject: `⚡ Faltam 3 dias para seu trial expirar!`,
    html: `
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">⚡ Faltam 3 dias!</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            <p style="font-size: 16px;">Seu período de teste termina em <strong>3 dias</strong>. Não perca acesso ao seu cardápio, mesas e pedidos!</p>
            <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #b45309; margin: 0;">3 dias restantes</p>
            </div>
            <p style="font-size: 16px;">Assine agora e continue sem interrupções. A partir de <strong>R$ 49,90/mês</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.planosUrl || 'https://foodie-comanda-dash.lovable.app/planos'}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Ver Planos e Assinar</a>
            </div>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Food Comanda Pro</p>
        </div>
      </body></html>
    `
  }),

  trial_expired: (data) => ({
    subject: `😢 Seu trial expirou — 20% OFF para assinar agora`,
    html: `
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">😢 Seu trial expirou</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            <p style="font-size: 16px;">Seu período de teste terminou, mas seus dados estão salvos! Assine nas próximas 48h e ganhe <strong>20% de desconto</strong>.</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ef4444; text-align: center;">
              <p style="font-size: 20px; font-weight: bold; color: #dc2626; margin: 0;">🎁 20% OFF — Oferta limitada</p>
              <p style="color: #6b7280; margin: 8px 0 0 0;">Válido por 48 horas</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.planosUrl || 'https://foodie-comanda-dash.lovable.app/planos'}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Assinar com 20% OFF</a>
            </div>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Food Comanda Pro</p>
        </div>
      </body></html>
    `
  }),

  trial_reengagement: (data) => ({
    subject: `💚 Sentimos sua falta! Volte com 30 dias grátis`,
    html: `
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">💚 Sentimos sua falta!</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">Olá <strong>${data.nome || 'Cliente'}</strong>,</p>
            <p style="font-size: 16px;">Faz um tempo que você não acessa o Food Comanda Pro. Preparamos algo especial:</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #16a34a; text-align: center;">
              <p style="font-size: 20px; font-weight: bold; color: #166534; margin: 0;">🎉 30 dias grátis para você voltar!</p>
              <p style="color: #6b7280; margin: 8px 0 0 0;">Sem compromisso. Cancele quando quiser.</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.loginUrl || 'https://foodie-comanda-dash.lovable.app/admin'}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Voltar Agora — 30 Dias Grátis</a>
            </div>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Food Comanda Pro</p>
        </div>
      </body></html>
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
    const fromEmail = Deno.env.get("EMAIL_FROM") || "Food Comanda <onboarding@resend.dev>";
    
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
