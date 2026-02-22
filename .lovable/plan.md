

# Implementacao: Contador de Mesas + Edge Function de Emails do Trial

## Parte 1: Contador de uso de mesas em Mesas.tsx

Adicionar um badge visual logo abaixo do subtitulo da pagina (linha 305) mostrando quantas mesas foram criadas vs o limite do plano.

**Arquivo:** `src/pages/admin/Mesas.tsx`

**O que muda:**
- Inserir entre as linhas 305-306 um indicador condicional (so aparece se `mesasLimit` existir)
- Formato: "X de Y mesas" com cores dinamicas:
  - Verde (normal): uso abaixo de 80%
  - Amarelo (aviso): uso entre 80-99%
  - Vermelho (limite): uso em 100%
- Quando atinge 100%, exibe texto "Limite atingido - Faca upgrade"

**Dados utilizados:**
- `mesas?.length` (ja carregado na query existente)
- `mesasLimit` (ja importado do hook `useUserRole` na linha 47)
- Nenhuma query adicional necessaria

---

## Parte 2: Novos templates de email em send-email

**Arquivo:** `supabase/functions/send-email/index.ts`

Expandir o tipo `EmailRequest` para aceitar 6 novos tipos de template e adicionar os templates HTML correspondentes:

| Template | Assunto |
|---|---|
| `trial_welcome` | Bem-vindo! Como comecar em 5 minutos |
| `trial_tip_cardapio` | Voce ja criou seu cardapio digital? |
| `trial_midpoint` | Metade do seu trial! Veja o que conquistou |
| `trial_urgency` | Faltam 3 dias para seu trial expirar |
| `trial_expired` | Seu trial expirou - 20% OFF para assinar |
| `trial_reengagement` | Sentimos sua falta! Volte com 30 dias gratis |

Cada template seguira o mesmo padrao visual dos emails existentes (gradiente verde, cards brancos, botoes CTA).

---

## Parte 3: Edge Function trial-email-sequence

**Novo arquivo:** `supabase/functions/trial-email-sequence/index.ts`

**Logica da funcao:**
1. Consulta `assinaturas` com status `trial` ou `trialing` usando service role key
2. Para cada assinatura, busca o email do usuario via `profiles`
3. Calcula quantos dias se passaram desde `data_inicio`
4. Verifica `trial_emails_sent` (jsonb array) para nao reenviar
5. Se o dia corresponde a um email da sequencia (0, 3, 7, 11, 14, 21), envia via fetch interno para `send-email`
6. Atualiza `trial_emails_sent` com o template enviado

**Configuracao:**
- Adicionar `[functions.trial-email-sequence]` com `verify_jwt = false` no `supabase/config.toml`
- Usa secrets ja existentes: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`

---

## Secao Tecnica

### Arquivos alterados
| Arquivo | Tipo | Descricao |
|---|---|---|
| `src/pages/admin/Mesas.tsx` | Modificado | Badge de uso vs limite |
| `supabase/functions/send-email/index.ts` | Modificado | 6 novos templates HTML |
| `supabase/functions/trial-email-sequence/index.ts` | Novo | Cron de sequencia de emails |
| `supabase/config.toml` | Modificado | Entrada para nova funcao |

### Dependencias
- Nenhuma nova dependencia necessaria
- Todos os secrets ja estao configurados (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY)

