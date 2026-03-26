

# Plano: Notificações Push Nativas (estilo WhatsApp/Instagram)

## Problema Atual
O sistema atual usa `showLocalNotification` que só funciona com a aba aberta. Para notificações aparecerem mesmo com o app fechado (como WhatsApp/Instagram), é necessário implementar **Web Push API** com VAPID keys e um backend que envie as notificações.

## Arquitetura

```text
[Novo pedido] → [Realtime trigger no OrderNotificationBadge]
                      ↓
              [Chama Edge Function send-push-notification]
                      ↓
              [Edge Function busca subscriptions da empresa]
                      ↓
              [Envia Web Push para cada dispositivo]
                      ↓
              [Service Worker recebe push event]
                      ↓
              [Exibe notificação nativa do SO ← igual WhatsApp]
```

## Etapas

### 1. Gerar VAPID Keys e armazenar como secrets
- Gerar par de chaves VAPID (pública + privada)
- Armazenar `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` como secrets
- A chave pública será usada no frontend para subscribe; a privada no backend para enviar

### 2. Criar tabela `push_subscriptions` (migração SQL)
```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key