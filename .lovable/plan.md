

# Fluxo de Trial Gratuito sem Cartão de Crédito

## Problema Atual
Ao selecionar um plano na página /planos, o usuário é redirecionado para o checkout do Stripe (pede cartão). Isso contradiz o texto "Não pedimos cartão de crédito durante o período de teste".

## Novo Fluxo

```text
Novo usuário:
/planos → seleciona plano → /auth (cadastro) → /admin/onboarding (dados empresa) → /admin (14 dias grátis)

Trial expirado:
Login → SubscriptionGuard bloqueia → Popup com planos:
  - Plano atual do trial: botão "Continuar" → Stripe checkout
  - Outros planos: botão "Selecionar" → Stripe checkout (upgrade)

Após pagamento:
Stripe checkout → /subscription/success → /admin (acesso liberado, dados preservados)
```

## Alterações

### 1. `src/pages/Planos.tsx` — `handleSelectPlan` (linhas 265-326)
- **Novo usuário (sem empresaId):** salvar plano no localStorage e redirecionar para `/auth` (sem Stripe)
- **Usuário logado (com empresaId):** manter fluxo atual de checkout Stripe (upgrade/renovação)

### 2. `src/pages/admin/Onboarding.tsx` — Corrigir colunas da assinatura (linhas 111-180)
- Substituir colunas inexistentes (`trial_start`, `trial_end`, `current_period_start`, `current_period_end`) pelas colunas reais: `data_inicio`, `data_fim`, `trial_fim`
- Corrigir `trialDays: 3` para `trialDays: 14` no e-mail de boas-vindas (linha 198)
- Garantir que a assinatura trial é criada corretamente sem Stripe

### 3. `src/components/UpgradeModal.tsx` — Botão "Continuar" no plano atual
- Adicionar prop `currentPlanSlug` (slug do plano do trial)
- No plano que corresponde ao trial: exibir botão "Continuar" (vai para Stripe checkout desse plano)
- Nos outros planos: manter botão "Selecionar" (vai para Stripe checkout do plano escolhido — upgrade)
- Ocultar botão "Fazer Downgrade" e "Fechar" quando `isBlocking=true`

### 4. `src/components/subscription/SubscriptionGuard.tsx` — Passar slug do plano ao modal
- No `useSubscription`, buscar também o `plano_id` e slug do plano da assinatura
- Passar `currentPlanSlug` ao `BlockedAccessContent` e ao `UpgradeModal`

### 5. `src/pages/Auth.tsx` — Redirecionar para onboarding com plano
- Após signup, se houver `post_subscribe_plan` no localStorage, redirecionar para `/admin/onboarding?planoId=...&periodo=...` em vez de `/admin`

### Dados preservados
Os dados cadastrados durante o trial (mesas, cardápio, categorias, etc.) são vinculados à `empresa_id` e ficam intactos. Após o pagamento, a assinatura muda de `trialing` para `active` — nenhum dado é perdido.

## Detalhes Técnicos

**Colunas corretas da tabela `assinaturas`:** `data_inicio`, `data_fim`, `trial_fim` (não existem `trial_start`, `trial_end`, `current_period_start`, `current_period_end`)

**Arquivos modificados:** 5 arquivos (Planos.tsx, Onboarding.tsx, UpgradeModal.tsx, SubscriptionGuard.tsx, Auth.tsx)

