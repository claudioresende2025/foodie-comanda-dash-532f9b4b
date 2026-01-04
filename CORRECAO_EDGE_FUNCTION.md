# CORREÇÃO: Edge Function - Erro de Pagamento com Cartão

## 🔴 Problema

Erro "Edge Function returned a non-2xx status code" ao clicar em "Pagar com Cartão de Crédito"

**Causa:** A chave do Stripe não está configurada nas Edge Functions do Supabase

## ✅ Solução Rápida (3 Passos)

### 1️⃣ Obter Chave do Stripe

1. Acesse: https://dashboard.stripe.com/test/apikeys
2. Copie a **Secret key** (começa com `sk_test_...` para modo teste)
3. ⚠️ Nunca compartilhe esta chave!

### 2️⃣ Configurar no Supabase

1. Acesse o painel de funções:
   👉 https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/settings/functions

2. Role até a seção **"Secrets"** (Segredos)

3. Clique em **"Add new secret"**

4. Adicione:
   - **Name:** `STRIPE_SECRET_KEY`
   - **Value:** cole a chave do Stripe (`sk_test_...`)

5. Clique em **"Add secret"**

### 3️⃣ Fazer Deploy das Correções

**Opção A - Via Terminal (Recomendado):**
```bash
./deploy-functions.sh
```

**Opção B - Manual via Dashboard:**
1. Acesse: https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/functions
2. Para cada função (create-delivery-checkout, verify-delivery-payment, complete-delivery-order):
   - Clique na função
   - Clique em "Deploy"
   - Aguarde o deploy

## ✅ O que foi Corrigido no Código

✔️ Melhor tratamento de erros
✔️ Mensagens mais claras para o usuário
✔️ Validação de configuração do Stripe
✔️ Logs detalhados para debug

## 🧪 Como Testar

1. Acesse o delivery do restaurante
2. Adicione produtos ao carrinho
3. Clique em "Finalizar Pedido"
4. Escolha "Cartão de Crédito"
5. Preencha o endereço
6. Clique em "Pagar"

**Resultado esperado:** Você será redirecionado para a página de pagamento do Stripe

## 📝 Notas Importantes

- ⚠️ Use `sk_test_...` para testes (não cobra de verdade)
- ⚠️ Use `sk_live_...` apenas em produção (cobra de verdade)
- ⚠️ Nunca commite as chaves secretas no código
- ✅ As chaves ficam seguras nos Secrets do Supabase

## 🆘 Precisa de Ajuda?

Se o erro persistir:
1. Verifique se a chave do Stripe está correta
2. Confirme que salvou o secret com o nome exato: `STRIPE_SECRET_KEY`
3. Aguarde 1-2 minutos após adicionar o secret
4. Limpe o cache do navegador e teste novamente
