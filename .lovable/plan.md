

# Corrigir referências restantes de "3 dias" para "14 dias"

## Problemas Encontrados

1. **`supabase/functions/send-email/index.ts` (linha 40)**: Fallback `${data.trialDays || 3}` — se `trialDays` não for passado, mostra "3 dias"
2. **`supabase/functions/create-subscription-checkout/index.ts` (linha 204)**: Fallback `trial_days ?? plano.trial_days ?? 3` — último fallback é 3
3. **Coluna `trial_days` da tabela `planos`**: Valor default do schema é `3` (embora os planos atuais já tenham `14`, novos planos criados teriam default `3`)
4. **Assinatura não criada**: A tabela `assinaturas` está vazia para sua empresa (`44312b39-269f-4abd-adba-ca5502ef2a92`), indicando que o onboarding não criou a assinatura corretamente

## Alterações

### 1. `supabase/functions/send-email/index.ts` — linha 40
- `${data.trialDays || 3}` → `${data.trialDays || 14}`

### 2. `supabase/functions/create-subscription-checkout/index.ts` — linha 204
- `trial_days ?? plano.trial_days ?? 3` → `trial_days ?? plano.trial_days ?? 14`

### 3. Migration SQL — alterar default da coluna `trial_days`
```sql
ALTER TABLE planos ALTER COLUMN trial_days SET DEFAULT 14;
```

### 4. Criar assinatura trial para a empresa atual
Inserir registro na tabela `assinaturas` com trial de 14 dias para a empresa `44312b39-269f-4abd-adba-ca5502ef2a92`, usando o plano Bronze (Iniciante).

