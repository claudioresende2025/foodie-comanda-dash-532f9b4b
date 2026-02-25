

# Correção: Trial de 14 dias em todas as páginas

## Problema

O trial foi alterado para 14 dias no onboarding, mas os valores antigos (3 e 7 dias) ainda estão hardcoded em vários arquivos.

## Alterações Necessárias

| Arquivo | Linha(s) | De | Para |
|---------|----------|-----|------|
| `src/pages/Planos.tsx` | 149 | `trial_days: 3` | `trial_days: 14` |
| `src/pages/Planos.tsx` | 168 | `trial_days: 3` | `trial_days: 14` |
| `src/pages/Planos.tsx` | 187 | `trial_days: 7` | `trial_days: 14` |
| `src/pages/Planos.tsx` | 215 | `p.trial_days ?? 3` | `p.trial_days ?? 14` |
| `src/pages/Planos.tsx` | 300 | `plano.trial_days ?? 3` | `plano.trial_days ?? 14` |
| `src/components/UpgradeModal.tsx` | 33 | `trial: 3` (Bronze) | `trial: 14` |
| `src/components/UpgradeModal.tsx` | 52 | `trial: 3` (Prata) | `trial: 14` |
| `src/components/UpgradeModal.tsx` | 71 | `trial: 7` (Ouro) | `trial: 14` |
| `src/pages/admin/Assinatura.tsx` | 399 | `defaultTrialDays = planSlug === 'ouro' ? 7 : 3` | `defaultTrialDays = 14` |
| `src/pages/subscription/Success.tsx` | 318 | `trialDays: 3` | `trialDays: 14` |

## Banco de Dados

Também será necessário atualizar os registros na tabela `planos` para que o campo `trial_days` reflita 14 em todos os planos:

```sql
UPDATE public.planos SET trial_days = 14 WHERE trial_days IS NOT NULL;
```

## Resultado

Todos os planos exibirão "Trial de 14 dias" tanto na página de Planos quanto no modal de Upgrade, e o backend usará 14 dias como padrão.

