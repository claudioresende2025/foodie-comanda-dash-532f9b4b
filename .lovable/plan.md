

# Plano: Corrigir erros de build + Implementar Push Notifications nativas

## Erros de Build (2 correções imediatas)

### 1. `DeliveryRestaurant.tsx` - Import faltando do UpsellDialog
O componente `UpsellDialog` é usado na linha 1382 mas nunca foi importado. Adicionar:
```typescript
import { UpsellDialog } from "@/components/delivery/UpsellDialog";
```

### 2. `usePushNotifications.ts` - Tipo Uint8Array incompatível (linha 159)
O TypeScript reclama que `Uint8Array<ArrayBufferLike>` não é assignable a `BufferSource`. Corrigir com cast explícito:
```typescript
applicationServerKey: applicationServerKey as BufferSource
```

## Push Notifications Nativas (estilo WhatsApp/Instagram)

O sistema de push já tem toda a infraestrutura montada (VAPID keys, tabela `push_subscriptions`, edge function `send-push-notification`, service worker com handlers de push). O que falta para funcionar end-to-end:

### 3. Adicionar VAPID secrets no backend
Verificar se `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` estão configurados como secrets. Se não, usar `add_secret` para solicitar ao usuário.

### 4. Integrar chamada da edge function no `OrderNotificationBadge`
Quando um novo pedido chega via realtime, além do badge local, chamar a edge function `send-push-notification` para disparar push nativo para todos os dispositivos registrados da empresa. Isso garante que mesmo com app/browser fechado, a notificação aparece no SO.

### 5. Ativar subscribe automático no AdminLayout
Ao carregar o painel admin, chamar `subscribeToNotifications()` automaticamente (se permissão já concedida) para registrar o dispositivo na tabela `push_subscriptions`.

### 6. Service Worker já tem os handlers
O `src/sw.ts` já implementa `push` e `notificationclick` listeners. O `vite.config.ts` precisa estar configurado para usar `injectManifest` com este SW customizado (verificar).

## Arquivos a modificar
- `src/pages/DeliveryRestaurant.tsx` - adicionar import
- `src/hooks/usePushNotifications.ts` - fix tipo
- `src/components/admin/OrderNotificationBadge.tsx` - chamar edge function
- `src/components/admin/AdminLayout.tsx` - auto-subscribe
- `vite.config.ts` - verificar config SW

