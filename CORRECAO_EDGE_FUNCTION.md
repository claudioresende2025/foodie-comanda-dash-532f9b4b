# CORREÇÃO: Edge Function - Erro de Status Non-2xx

## 🔴 Problema Identificado

O erro "Edge Function returned a non-2xx status code" ocorre quando:
1. A chave do Stripe não está configurada nas Edge Functions
2. Há um erro de validação nos dados do pedido
3. Problema de CORS ou configuração da função

## ✅ Solução

### Passo 1: Configurar Secrets no Supabase

Você precisa adicionar os segredos (secrets) no painel do Supabase:

1. Acesse: https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/settings/functions
2. Na seção "Secrets", adicione:
   - **STRIPE_SECRET_KEY**: sua chave secreta do Stripe (começa com `sk_`)
   - **SUPABASE_SERVICE_ROLE_KEY**: já deve estar configurada automaticamente

### Passo 2: Obter Chave do Stripe

1. Acesse: https://dashboard.stripe.com/test/apikeys
2. Copie a "Secret key" (começa com `sk_test_`)
3. Cole no campo STRIPE_SECRET_KEY no Supabase

### Passo 3: Verificar Configuração

Após adicionar os secrets, as Edge Functions serão reiniciadas automaticamente.

## 🔧 Correção Alternativa (Tratamento de Erro Melhorado)

Vou melhorar o tratamento de erro no código para dar uma mensagem mais clara ao usuário.

## 📝 Notas

- As Edge Functions precisam de secrets configurados no painel do Supabase
- Os secrets não ficam no código por questões de segurança
- Após configurar, teste novamente o pagamento com cartão
