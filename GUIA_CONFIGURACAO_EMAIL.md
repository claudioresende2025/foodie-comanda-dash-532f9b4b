# Guia de Configuração de E-mails - Food Comanda Pro

## 📊 Status Atual do Sistema

### ✅ O que JÁ ESTÁ IMPLEMENTADO:

1. **Edge Function `send-email`** - Função completa com templates HTML para:
   - `welcome` - Boas-vindas (cadastro geral)
   - `trial_welcome` - Início do trial (proprietário)
   - `trial_tip_cardapio` - Dica de cardápio (dia 3)
   - `trial_midpoint` - Meio do trial (dia 7)
   - `trial_urgency` - Urgência (dia 11)
   - `trial_expired` - Trial expirado (dia 14)
   - `trial_reengagement` - Reengajamento (dia 21)
   - `subscription_confirmed` - Assinatura confirmada
   - `payment_receipt` - Recibo de pagamento
   - `trial_reminder` - Lembrete de trial

2. **Edge Function `trial-email-sequence`** - Sequência automática de e-mails durante trial

3. **Webhook Stripe** - Já envia e-mails quando:
   - Assinatura é confirmada
   - Pagamento é processado
   - Trial está próximo do fim

### ❌ O que FALTA CONFIGURAR:

1. **RESEND_API_KEY** - Chave da API do Resend
2. **EMAIL_FROM** - E-mail remetente verificado
3. **Domínio verificado** (opcional, mas recomendado)
4. **Cron Job** para sequência de trial

---

## 🔧 PASSO A PASSO PARA CONFIGURAR

### PASSO 1: Obter API Key do Resend

1. Acesse https://resend.com e faça login
2. Vá em **API Keys** → **Create API Key**
3. Nome: `food-comanda-production`
4. Permissão: `Full access`
5. **Copie a chave** (formato: `re_xxxxxxxxxx`)

### PASSO 2: Configurar Secrets no Supabase

No terminal, execute:

```bash
npx supabase secrets set RESEND_API_KEY="re_SUA_CHAVE_AQUI"
```

Ou pelo Dashboard do Supabase:
1. Vá em **Edge Functions** → **Secrets**
2. Adicione:
   - `RESEND_API_KEY` = `re_SUA_CHAVE_AQUI`

### PASSO 3: Configurar E-mail Remetente

**SEM DOMÍNIO PRÓPRIO (usando Resend de teste):**
- O sistema usará: `Food Comanda <onboarding@resend.dev>`
- ⚠️ Limitação: Só pode enviar para e-mails verificados no Resend

**COM DOMÍNIO PRÓPRIO (recomendado para produção):**
1. No Resend, vá em **Domains** → **Add Domain**
2. Adicione seu domínio (ex: `foodcomanda.com.br`)
3. Configure os registros DNS:
   ```
   Tipo: MX    | Nome: @      | Valor: feedback-smtp.resend.com
   Tipo: TXT   | Nome: @      | Valor: v=spf1 include:_spf.resend.com ~all
   Tipo: CNAME | Nome: resend | Valor: eu.smtp.dev
   ```
4. Aguarde verificação (pode levar até 48h)
5. Configure o EMAIL_FROM:
   ```bash
   npx supabase secrets set EMAIL_FROM="Food Comanda <noreply@seudominio.com.br>"
   ```

### PASSO 4: Testar Envio de E-mail

Execute este comando para testar:

```bash
curl -X POST "https://SEU_PROJECT_ID.supabase.co/functions/v1/send-email" \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "to": "seu-email@gmail.com",
    "data": {
      "nome": "Teste",
      "trialDays": 14,
      "loginUrl": "https://foodie-comanda-dash.lovable.app/admin"
    }
  }'
```

### PASSO 5: Configurar Cron Job para E-mails de Trial

No Supabase Dashboard:
1. Vá em **Database** → **Extensions**
2. Ative `pg_cron` se não estiver ativo
3. Vá em **SQL Editor** e execute:

```sql
-- Criar schedule para verificar e enviar e-mails de trial diariamente
SELECT cron.schedule(
  'trial-email-sequence',
  '0 10 * * *', -- Às 10:00 todo dia
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_ID.supabase.co/functions/v1/trial-email-sequence',
    headers := '{"Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## 📧 FLUXO DE E-MAILS

### Quando PROPRIETÁRIO contrata um plano:

```
1. Cadastro → Supabase Auth cria usuário
2. Trial inicia → trial_welcome (dia 0)
3. Sequência automática:
   - Dia 3: trial_tip_cardapio
   - Dia 7: trial_midpoint  
   - Dia 11: trial_urgency
   - Dia 14: trial_expired
   - Dia 21: trial_reengagement
4. Se assinar → subscription_confirmed
5. Cada pagamento → payment_receipt
```

### Quando CLIENTE se cadastra para delivery:

O sistema atual **NÃO envia e-mail** para clientes de delivery.
Se quiser, posso implementar um e-mail de boas-vindas para clientes.

---

## 🚀 CONFIGURAÇÃO RÁPIDA (SEM DOMÍNIO)

Se você quer testar AGORA sem domínio:

1. No Resend, vá em **Emails** → **Add email**
2. Adicione seu e-mail pessoal para testes
3. Configure o secret:
   ```bash
   npx supabase secrets set RESEND_API_KEY="re_SUA_CHAVE"
   ```
4. Teste enviando para seu e-mail verificado

---

## ⚠️ LIMITAÇÕES SEM DOMÍNIO VERIFICADO

- Só pode enviar para e-mails verificados no Resend
- Não pode enviar para clientes reais
- E-mails vão de `onboarding@resend.dev`
- Limite de 100 e-mails/dia no plano gratuito

---

## 📋 CHECKLIST FINAL

- [ ] API Key do Resend configurada
- [ ] Testar envio para e-mail próprio
- [ ] (Opcional) Verificar domínio próprio
- [ ] (Opcional) Configurar Cloudflare DNS
- [ ] (Opcional) Configurar cron job para trial sequence
- [ ] Testar fluxo completo de cadastro

---

## 🔍 VERIFICAR LOGS

Para ver logs de envio de e-mail:

1. Supabase Dashboard → **Edge Functions** → **send-email** → **Logs**
2. Procure por `[SEND-EMAIL]`

---

## 📞 SUPORTE

Se tiver problemas:
1. Verifique os logs da Edge Function
2. Confirme que a API Key está correta
3. Verifique se o e-mail destino está verificado (sem domínio)
