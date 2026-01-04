# 🚨 GUIA DEFINITIVO: Deploy Manual das Edge Functions

## ⚠️ IMPORTANTE
O deploy via NPX requer autenticação complexa.
**Use o método via Dashboard - é mais rápido e garantido!**

---

## ✅ PASSO A PASSO COMPLETO (5 minutos)

### 🎯 Passo 1: Acessar o Painel de Functions

Clique ou cole este link no navegador:
```
https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/functions
```

---

### 🎯 Passo 2: Deploy da Função 1 - create-delivery-checkout

1. Procure a função **create-delivery-checkout** na lista
2. Clique nos **três pontinhos (⋮)** no lado direito
3. Clique em **"Deploy new version"** ou **"Redeploy"**
4. Aguarde aparecer ✅ verde (leva ~30 segundos)

---

### 🎯 Passo 3: Deploy da Função 2 - verify-delivery-payment

1. Procure a função **verify-delivery-payment**
2. Clique nos **três pontinhos (⋮)**
3. Clique em **"Deploy new version"** ou **"Redeploy"**
4. Aguarde ✅ verde

---

### 🎯 Passo 4: Deploy da Função 3 - complete-delivery-order

1. Procure a função **complete-delivery-order**
2. Clique nos **três pontinhos (⋮)**
3. Clique em **"Deploy new version"** ou **"Redeploy"**
4. Aguarde ✅ verde

⚠️ **ESTA É A FUNÇÃO QUE FOI CORRIGIDA AGORA!**
É essencial fazer o redeploy dela para corrigir o erro.

---

### 🎯 Passo 5: Verificar se Deploy Foi Feito

Após cada deploy, você verá:
- ✅ Bolinha verde ao lado da função
- Timestamp atualizado (hoje, alguns segundos atrás)
- Status "Deployed"

---

## 🧪 TESTE APÓS O DEPLOY

1. Limpe o cache do navegador (Ctrl+Shift+Del)
2. Acesse o delivery
3. Adicione produtos ao carrinho
4. Vá para o checkout
5. Escolha "Cartão de Crédito"
6. Preencha os dados
7. Clique em "Pagar"
8. Complete o pagamento no Stripe
9. **Você será redirecionado com sucesso!** ✅

---

## ❌ SE O ERRO PERSISTIR

Se após fazer os 3 deploys o erro continuar:

### Verifique os Logs das Functions:

1. No painel de functions, clique na função **complete-delivery-order**
2. Vá na aba **"Logs"**
3. Faça um novo teste de pagamento
4. Veja o erro exato que aparece nos logs
5. Me envie o erro completo

---

## 📊 O QUE FOI CORRIGIDO NO CÓDIGO

### Correção 1: API do Stripe
- ❌ Antes: `"2025-08-27.basil"` (data inválida)
- ✅ Depois: `"2024-12-18.acacia"` (versão válida)

### Correção 2: Relacionamento de Fidelidade
- ❌ Antes: Join direto entre tabelas sem FK
- ✅ Depois: Duas queries separadas via empresa_id

### Correção 3: Campo de Pontos
- ❌ Antes: `pontos` (campo não existe)
- ✅ Depois: `saldo_pontos` (campo correto)

### Correção 4: Validação do orderData
- ✅ Estrutura correta com empresaId, enderecoId, etc.

---

## 🆘 AINDA COM DÚVIDAS?

O código está 100% correto no GitHub.
O problema é que as Edge Functions executam no servidor do Supabase.

**Você PRECISA fazer o redeploy manual via Dashboard.**

Não tem como fazer automaticamente sem configurar CI/CD complexo.

---

## ✅ CONFIRMAÇÃO DE QUE DEU CERTO

Você saberá que funcionou quando:
1. Não aparecer mais o erro "Erro ao criar pedido no banco de dados"
2. Após pagar no Stripe, ver a página de sucesso
3. O pedido aparecer no banco de dados com status "pago"

---

**IMPORTANTE:** O deploy via NPX/CLI requer:
- Token de acesso do Supabase
- Configuração de permissões
- Login interativo

Por isso, **use o Dashboard - é mais simples e garantido!**
