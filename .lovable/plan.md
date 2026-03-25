

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
  auth_key text NOT NULL,
  type text NOT NULL DEFAULT 'admin', -- 'admin' ou 'delivery'
  created_at timestamptz DEFAULT now(),
  UNIQUE(endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- RLS: usuário pode gerenciar suas próprias subscriptions
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Staff pode ler subscriptions da empresa (para envio)
CREATE POLICY "Staff can read empresa subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
```

### 3. Criar Edge Function `send-push-notification`
- Recebe `empresa_id`, `title`, `body`, `type` (salon/delivery), `url`
- Busca todas subscriptions admin da empresa
- Usa biblioteca `web-push` (Deno) para enviar para cada endpoint
- Usa VAPID keys do secrets

### 4. Atualizar Service Worker (`dev-dist/sw.js` e config Vite)
- Adicionar listener `self.addEventListener('push', ...)` para mostrar notificação nativa
- Adicionar listener `self.addEventListener('notificationclick', ...)` para abrir a URL correta ao clicar

### 5. Atualizar `usePushNotifications.ts`
- Implementar subscribe real com VAPID public key
- Ao obter permissão, registrar subscription no banco (`push_subscriptions`)
- Salvar `empresa_id` para admin, `null` para delivery

### 6. Atualizar `OrderNotificationBadge.tsx`
- Quando detectar novo pedido via realtime, além do badge/som local, chamar a edge function `send-push-notification` para notificar TODOS os dispositivos admin da empresa (inclusive os que estão fechados)

### 7. Manter tudo que já existe
- O badge flutuante, o som, o preview popup -- tudo continua funcionando como está
- As notificações push são uma camada ADICIONAL

## Resultado
- Celular com app instalado (PWA) receberá notificação igual WhatsApp mesmo com tela bloqueada
- Computador com Chrome/Edge receberá notificação nativa do SO
- O badge in-app continua funcionando normalmente

## Arquivos
- **Novo**: `supabase/functions/send-push-notification/index.ts`
- **Modificar**: `src/hooks/usePushNotifications.ts` (subscribe real com VAPID)
- **Modificar**: `src/components/admin/OrderNotificationBadge.tsx` (chamar edge function)
- **Modificar**: `dev-dist/sw.js` (push + notificationclick handlers)
- **Migração SQL**: criar tabela `push_subscriptions`
- **Secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

