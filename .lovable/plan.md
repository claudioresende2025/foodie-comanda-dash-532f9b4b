
# Correcao de Bugs Criticos do QA

## Resumo
Corrigir 4 bugs identificados no QA: padronizar `trial_fim` para `trial_end`, corrigir textos enganosos na pagina de Planos, e mover `useLocation` para o topo do componente.

## Alteracoes

### 1. SubscriptionGuard.tsx - `trial_fim` para `trial_end`
- Linha 191: `.select('status, data_fim, trial_fim, canceled_at')` -> `.select('status, data_fim, trial_end, canceled_at')`
- Linha 246: `assinatura.trial_fim` -> `assinatura.trial_end`
- Linha 258: `assinatura.trial_fim` -> `assinatura.trial_end` (condicao if)
- Linha 263: `trial_ends_at: assinatura.trial_fim` -> `trial_ends_at: assinatura.trial_end`

### 2. TrialValueBanner.tsx - `trial_fim` para `trial_end`
- Linha 22: `.select('status, trial_fim, data_inicio')` -> `.select('status, trial_end, data_inicio')`
- Linha 50: `assinatura.trial_fim` -> `assinatura.trial_end`

### 3. Assinatura.tsx - `trial_fim` para `trial_end`
- Linha 57: interface `trial_fim: string | null` -> `trial_end: string | null`
- Linha 396: `assinatura?.trial_fim` -> `assinatura?.trial_end`
- Linha 434: `assinatura?.trial_fim` -> `assinatura?.trial_end`
- Linha 435: `assinatura!.trial_fim` -> `assinatura!.trial_end`
- Todas as demais referencias a `trial_fim` no arquivo

### 4. Planos.tsx - Textos enganosos e useLocation
- Linha 400: `"14 dias gratis em qualquer plano"` -> `"Teste gratis disponivel em todos os planos"`
- Linha 410: `"Sem cartao de credito . 7 dias de garantia apos assinar"` -> `"Cancele quando quiser . 7 dias de garantia apos assinar"`
- Mover `useLocation()` da linha 359 (dentro de IIFE no JSX) para o topo do componente (depois de `useNavigate()` na linha 68), e usar a variavel `location` no JSX

## Detalhes Tecnicos

Todos os arquivos afetados:
- `src/components/subscription/SubscriptionGuard.tsx` (4 alteracoes)
- `src/components/admin/TrialValueBanner.tsx` (2 alteracoes)
- `src/pages/admin/Assinatura.tsx` (4+ alteracoes)
- `src/pages/Planos.tsx` (3 alteracoes)

Nenhuma alteracao de banco de dados necessaria - a coluna `trial_end` ja existe no banco.
