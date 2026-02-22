
# Correcoes no Modal de Upgrade e SubscriptionGuard

## Problema 1: Modal de planos aparece apos login
Isso e o comportamento correto -- o trial da sua empresa expirou em janeiro e estamos em fevereiro. O sistema esta bloqueando o acesso corretamente. Nenhuma correcao necessaria aqui.

## Problema 2: Clicar em plano vai para pagina de planos em vez de checkout
Quando voce clica em "Selecionar" no modal, o sistema navega para `/planos?mode=upgrade&plano=xxx`, que mostra a pagina de planos novamente em vez de ir direto para o checkout do Stripe.

**Correcao:** Alterar o `UpgradeModal` para chamar a funcao de checkout diretamente (invocar `create-subscription-checkout`) ao clicar em "Selecionar", redirecionando o usuario direto para o Stripe.

## Problema 3: Nome de coluna incorreto no SubscriptionGuard
O `SubscriptionGuard` consulta `trial_end` mas a coluna real no banco e `trial_fim`. Isso pode causar falha na consulta.

**Correcao:** Trocar `trial_end` por `trial_fim` no select da query.

---

## Secao Tecnica

### Arquivo: `src/components/UpgradeModal.tsx`

**Mudancas:**
- Importar `supabase` e `useState` e `toast`
- Adicionar estado `processingPlan` para controle de loading
- Substituir `handleUpgrade` para invocar `create-subscription-checkout` diretamente:
  1. Buscar `empresa_id` do perfil do usuario autenticado
  2. Buscar o `plano.id` real do banco de dados pelo slug
  3. Chamar `supabase.functions.invoke('create-subscription-checkout')` com os dados
  4. Redirecionar para a URL do Stripe retornada
- Manter o fallback de navegacao para `/planos` caso a chamada falhe
- Mostrar estado de loading no botao durante o processamento

### Arquivo: `src/components/subscription/SubscriptionGuard.tsx`

**Mudanca (linha 191):**
```
// De:
.select('status, data_fim, trial_end, canceled_at')
// Para:
.select('status, data_fim, trial_fim, canceled_at')
```

**Mudanca (linha 246):**
```
// De:
const trialFim = assinatura.trial_end ? new Date(assinatura.trial_end) : null;
// Para:
const trialFim = assinatura.trial_fim ? new Date(assinatura.trial_fim) : null;
```

### Arquivos afetados
- `src/components/UpgradeModal.tsx` (checkout direto)
- `src/components/subscription/SubscriptionGuard.tsx` (correcao nome coluna)
