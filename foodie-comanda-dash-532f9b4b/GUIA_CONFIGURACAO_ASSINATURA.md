# 🔧 Guia de Configuração do Sistema de Assinatura

Este guia contém todas as instruções para configurar o sistema de assinatura com Stripe.

## 📋 Checklist de Configuração

- [ ] 1. Aplicar migration SQL no Supabase
- [ ] 2. Configurar variáveis de ambiente no Supabase
- [ ] 3. Configurar webhook no Stripe Dashboard
- [ ] 4. Fazer deploy das Edge Functions
- [ ] 5. Adicionar super admin
- [ ] 6. Testar o fluxo

---

## 1️⃣ Aplicar Migration SQL

### Opção A: Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy
2. Clique em **SQL Editor** no menu lateral
3. Clique em **New Query**
4. Copie TODO o conteúdo do arquivo: `supabase/migrations/20260105_subscription_system.sql`
5. Cole no editor e clique **Run**
6. Verifique se aparece "Success" verde

### Opção B: Via CLI (se tiver SERVICE_ROLE_KEY)

```bash
export SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"
node apply-subscription-migration.js
```

---

## 2️⃣ Configurar Variáveis de Ambiente no Supabase

### 2.1 Obter chaves do Stripe

1. Acesse: https://dashboard.stripe.com/apikeys
2. Copie a **Secret key** (começa com `sk_live_` ou `sk_test_`)
3. Crie um webhook e copie o **Webhook signing secret** (começa com `whsec_`)

### 2.2 Adicionar secrets no Supabase

Execute no terminal:

```bash
# Stripe Secret Key
npx supabase secrets set STRIPE_SECRET_KEY="sk_test_SuaChaveAqui"

# Stripe Webhook Secret
npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_SuaChaveAqui"
```

Ou via Dashboard:
1. Acesse: https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/settings/vault
2. Clique em **Add a new secret**
3. Adicione:
   - `STRIPE_SECRET_KEY` = sua chave secreta
   - `STRIPE_WEBHOOK_SECRET` = seu webhook secret

---

## 3️⃣ Configurar Webhook no Stripe

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em **Add endpoint**
3. Configure:
   - **Endpoint URL**: `https://zlwpxflqtyhdwanmupgy.supabase.co/functions/v1/stripe-subscription-webhook`
   - **Events to send**: Selecione os seguintes eventos:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `charge.refunded`
4. Clique em **Add endpoint**
5. Copie o **Signing secret** que aparece (começa com `whsec_`)
6. Configure esse secret no Supabase (passo 2.2)

---

## 4️⃣ Deploy das Edge Functions

Execute no terminal:

```bash
cd /workspaces/foodie-comanda-dash-532f9b4b

# Deploy de todas as funções
npx supabase functions deploy create-subscription-checkout
npx supabase functions deploy stripe-subscription-webhook
npx supabase functions deploy request-refund
```

Ou deploy de todas de uma vez:

```bash
npx supabase functions deploy
```

### Configurar CORS das funções

Adicione no `supabase/config.toml`:

```toml
[functions.create-subscription-checkout]
verify_jwt = false

[functions.stripe-subscription-webhook]
verify_jwt = false

[functions.request-refund]
verify_jwt = true
```

---

## 5️⃣ Adicionar Super Admin

Execute esta query no SQL Editor do Supabase:

```sql
-- Substitua pelo seu email
INSERT INTO super_admins (user_id, email, nome, permissoes)
SELECT 
  id,
  email,
  'Administrador Master',
  '["all"]'::jsonb
FROM auth.users 
WHERE email = 'SEU_EMAIL_AQUI@example.com';
```

**OU** se preferir adicionar pelo ID:

```sql
INSERT INTO super_admins (user_id, email, nome, permissoes)
VALUES (
  'UUID_DO_USUARIO',
  'seu@email.com',
  'Administrador Master',
  '["all"]'::jsonb
);
```

---

## 6️⃣ Configurar PIX no Super Admin

1. Faça login como super admin
2. Acesse: `/super-admin`
3. Vá na aba **Configurações**
4. Configure suas chaves PIX:
   - Tipo da chave (CPF, CNPJ, Email, Telefone, Aleatória)
   - Valor da chave
   - Nome do beneficiário

---

## 🧪 Testar o Sistema

### Testar checkout:

1. Acesse `/planos`
2. Clique em "Começar Teste Grátis" em um plano
3. Complete o checkout do Stripe (use cartão de teste: `4242 4242 4242 4242`)

### Cartões de teste do Stripe:

| Número | Descrição |
|--------|-----------|
| `4242 4242 4242 4242` | Pagamento bem-sucedido |
| `4000 0000 0000 0002` | Cartão recusado |
| `4000 0000 0000 9995` | Fundos insuficientes |

### Testar webhook:

```bash
# Instale o Stripe CLI
brew install stripe/stripe-cli/stripe

# Faça login
stripe login

# Encaminhe webhooks para sua função local
stripe listen --forward-to https://zlwpxflqtyhdwanmupgy.supabase.co/functions/v1/stripe-subscription-webhook

# Em outro terminal, dispare um evento de teste
stripe trigger checkout.session.completed
```

---

## 📊 Verificar se Tudo Está Funcionando

Execute estas queries no SQL Editor para verificar:

```sql
-- Verificar se tabelas foram criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('planos', 'assinaturas', 'pagamentos_assinatura', 'reembolsos', 'config_sistema', 'super_admins');

-- Verificar planos criados
SELECT id, nome, preco_mensal, preco_anual FROM planos;

-- Verificar config_sistema
SELECT chave, valor FROM config_sistema;

-- Verificar super_admins
SELECT email, nome FROM super_admins;
```

---

## 🔐 Segurança

### Importante:

1. **Nunca** exponha a `STRIPE_SECRET_KEY` no frontend
2. **Nunca** commite secrets no repositório
3. Use modo **test** do Stripe durante desenvolvimento
4. Valide **sempre** o webhook signature

### Variáveis sensíveis:

| Variável | Onde usar | Público? |
|----------|-----------|----------|
| `STRIPE_PUBLISHABLE_KEY` | Frontend | ✅ Sim |
| `STRIPE_SECRET_KEY` | Edge Functions | ❌ Não |
| `STRIPE_WEBHOOK_SECRET` | Webhook handler | ❌ Não |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts admin | ❌ Não |

---

## ❓ Troubleshooting

### Erro: "Stripe não configurado"
- Verifique se `STRIPE_SECRET_KEY` está nos secrets do Supabase

### Erro: "Webhook signature verification failed"
- Verifique se `STRIPE_WEBHOOK_SECRET` está correto
- Certifique-se de usar o signing secret do webhook específico

### Erro: "Plano não encontrado"
- Execute a migration SQL para criar os planos padrão

### Erro: "Permissão negada"
- Verifique as políticas RLS nas tabelas

---

## 📞 Suporte

Se tiver problemas:

1. Verifique os logs das Edge Functions no Supabase Dashboard
2. Verifique os eventos no Stripe Dashboard → Developers → Webhooks
3. Use `console.log` nas funções para debug
