# 🚨 AÇÃO URGENTE: Deploy das Edge Functions

## ❌ Erro Atual
```
{error: "Dados obrigatórios ausentes: orderId, total, empresaId"}
```

## 🔍 Causa
As Edge Functions no Supabase estão com **código desatualizado**. 
O código foi corrigido no GitHub, mas ainda não foi deployado no servidor.

## ✅ SOLUÇÃO DEFINITIVA

### 🎯 Opção 1: Deploy Manual via Dashboard (5 minutos)

**Passo a passo:**

1. **Acesse o painel de Functions:**
   👉 https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/functions

2. **Para cada função abaixo, faça o REDEPLOY:**

   **a) create-delivery-checkout:**
   - Clique nos ⋮ (três pontinhos) ao lado da função
   - Clique em **"Redeploy"** ou **"Deploy new version"**
   - Aguarde a bolinha ficar verde (~30 segundos)

   **b) verify-delivery-payment:**
   - Clique nos ⋮ (três pontinhos)
   - Clique em **"Redeploy"**
   - Aguarde completar

   **c) complete-delivery-order:**
   - Clique nos ⋮ (três pontinhos)
   - Clique em **"Redeploy"**
   - Aguarde completar

3. **✅ TESTE:** Tente fazer um pedido com cartão novamente

---

### 🎯 Opção 2: Deploy via GitHub Actions (Automático)

Se você configurou GitHub Actions:

1. Acesse: https://github.com/claudioresende2025/foodie-comanda-dash-532f9b4b/actions
2. Execute o workflow de deploy (se existir)

---

### 🎯 Opção 3: Deploy via CLI Supabase

```bash
# Instalar CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref zlwpxflqtyhdwanmupgy

# Deploy das funções
supabase functions deploy create-delivery-checkout
supabase functions deploy verify-delivery-payment
supabase functions deploy complete-delivery-order
```

---

## 📊 O que foi corrigido no código (já no GitHub):

✅ Versão da API do Stripe corrigida (2024-12-18.acacia)
✅ Validação de dados do orderData correta
✅ Mensagens de erro mais claras
✅ Tratamento de erros melhorado
✅ Relacionamento de fidelidade corrigido

## ⚠️ IMPORTANTE

**O código está 100% correto no GitHub**, mas as Edge Functions executam no servidor do Supabase.
**Você PRECISA fazer o deploy para que as correções entrem em vigor.**

## 🎁 Sobre o Campo de Fidelidade

O campo para usar pontos de fidelidade **JÁ EXISTE** no formulário! 
Ele aparece automaticamente quando:
- O usuário tem pontos de fidelidade
- O restaurante tem programa de fidelidade ativo

Localização: Logo após o "Cartão Fidelidade" roxo, há uma seção 
"Usar Pontos de Fidelidade" com checkbox e slider para escolher quantos pontos usar.

---

## 🆘 Ainda com problema?

Se após o deploy o erro persistir:
1. Limpe o cache do navegador (Ctrl+Shift+Del)
2. Faça logout e login novamente
3. Teste em uma aba anônima
4. Verifique se a chave STRIPE_SECRET_KEY está configurada nos Secrets
