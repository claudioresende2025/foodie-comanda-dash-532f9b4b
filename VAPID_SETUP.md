# Configuração VAPID Keys para Web Push

## Chaves Geradas

```
Public Key:
BFnfc-2TdOfQYsbmLQUll_YEEjoVpzd9AAXpzwv5k_mOsm-WbRM-bYLDFVFLIp3E--Ut3amfvIlmteKgp1Skdno

Private Key:
UAzFXoZuhuFKyxWRstCG27APYsxX8dm2JYIMUpHAtTI
```

## Passos para Configurar

### 1. Configurar Secrets no Supabase

Acesse: https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/settings/functions

Na seção **Secrets**, adicione:

| Nome | Valor |
|------|-------|
| `VAPID_PUBLIC_KEY` | `BFnfc-2TdOfQYsbmLQUll_YEEjoVpzd9AAXpzwv5k_mOsm-WbRM-bYLDFVFLIp3E--Ut3amfvIlmteKgp1Skdno` |
| `VAPID_PRIVATE_KEY` | `UAzFXoZuhuFKyxWRstCG27APYsxX8dm2JYIMUpHAtTI` |

### 2. Variável de Ambiente Frontend

Adicione ao arquivo `.env.local` na raiz do projeto:

```env
VITE_VAPID_PUBLIC_KEY=BFnfc-2TdOfQYsbmLQUll_YEEjoVpzd9AAXpzwv5k_mOsm-WbRM-bYLDFVFLIp3E--Ut3amfvIlmteKgp1Skdno
```

### 3. Executar Migração SQL

Execute o arquivo `migrations/2026_03_25_create_push_subscriptions.sql` no Supabase SQL Editor.

### 4. Deploy da Edge Function

```bash
npx supabase functions deploy send-push-notification --project-ref zlwpxflqtyhdwanmupgy
```

## Verificação

Após configurar, teste a edge function:

```bash
curl -X POST 'https://zlwpxflqtyhdwanmupgy.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"empresa_id": "YOUR_EMPRESA_ID", "title": "Teste", "body": "Notificação de teste"}'
```

## Segurança

⚠️ **IMPORTANTE**: A chave privada deve permanecer secreta. Nunca a exponha no código frontend ou em repositórios públicos.

A chave pública pode ser exposta no frontend pois é usada apenas para o subscribe.
