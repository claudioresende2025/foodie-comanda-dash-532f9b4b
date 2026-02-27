

# Correção: Trial mostrando 3 dias ao invés de 14

## Problema Identificado
O banco de dados está correto — a assinatura mais recente tem `trial_fim` configurado para 14 dias (2026-03-13). O problema está no componente `TrialValueBanner.tsx` que busca a coluna **`trial_end`** (que não existe) ao invés de **`trial_fim`** (coluna real).

## Correções

### 1. `src/components/admin/TrialValueBanner.tsx`
- Linha 22: Trocar `trial_end` por `trial_fim` na query do Supabase
- Linha 50: Trocar `assinatura.trial_end` por `assinatura.trial_fim`

### 2. `supabase/functions/emit-nfce/index.ts` (fix build error)
- Linha 50: Substituir `getClaims(token)` por `getUser(token)` — o método `getClaims` não existe no SDK do Supabase

## Detalhes Técnicos
- A coluna padrão do sistema é `trial_fim` (conforme memória do projeto). O `TrialValueBanner` estava usando o nome antigo `trial_end`, resultando em `null` e cálculo incorreto dos dias restantes.
- O `SubscriptionGuard` já usa `trial_fim` corretamente — apenas o banner estava desatualizado.

