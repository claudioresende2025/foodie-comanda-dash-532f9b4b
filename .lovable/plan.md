

# Correção: Coluna trial no banco externo é `trial_end`

O banco externo (zlwpxflqtyhdwanmupgy) usa a coluna `trial_end` na tabela `assinaturas`, enquanto o Lovable Cloud usa `trial_fim`. O `.env` foi alterado para apontar ao banco externo, então o frontend precisa usar `trial_end`.

## Correções no código

### 1. `src/components/admin/TrialValueBanner.tsx`
- Na query (select), trocar `trial_fim` de volta para `trial_end`
- Na lógica de cálculo, trocar `assinatura.trial_fim` para `assinatura.trial_end`

### 2. Verificar `src/components/subscription/SubscriptionGuard.tsx`
- Confirmar qual coluna está sendo usada e alinhar com `trial_end` para compatibilidade com o banco externo

### 3. Verificar `src/pages/admin/Assinatura.tsx`
- Confirmar qual coluna está sendo usada e alinhar com `trial_end`

## SQL para o banco externo (já fornecido acima)
- UPDATE planos SET trial_days = 14
- UPDATE assinaturas SET trial_end = data_inicio + INTERVAL '14 days' WHERE status = 'trialing'

## Detalhe técnico
O `.env` agora aponta para `zlwpxflqtyhdwanmupgy` (banco externo). Esse banco usa `trial_end` ao invés de `trial_fim`. Todos os componentes que acessam essa coluna precisam ser consistentes com o schema do banco externo.

