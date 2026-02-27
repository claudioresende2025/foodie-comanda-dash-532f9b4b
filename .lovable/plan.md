

# Alterar "3 Dias" para "14 Dias" no trial

## Arquivos a alterar

### 1. `src/pages/Planos.tsx` (linha 569)
- `"3 Dias Grátis"` → `"14 Dias Grátis"`

### 2. `supabase/functions/send-email/index.ts`
- Linha 283: `"primeiros 3 dias"` → `"primeiros 14 dias"`
- Linha 331: `"Faltam 3 dias para seu trial expirar!"` → `"Faltam 3 dias para seu trial expirar!"` (manter — este é o e-mail de urgência enviado 3 dias antes do fim do trial de 14 dias, não o período total)
- Linhas 337, 341, 343: idem — manter, pois referem-se aos 3 dias **restantes** do trial, não ao período total

**Resumo:** Apenas 2 alterações reais — a página de Planos e o e-mail de onboarding. Os e-mails de urgência referem-se corretamente aos "3 dias restantes" do trial.

