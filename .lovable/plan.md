

# Plano: Dashboard Realtime + UpsellDialog no Menu + Notificações WhatsApp-style

## 1. Dashboard com atualização automática do faturamento

**Problema**: Os dados de faturamento só atualizam ao clicar "Atualizar".

**Solução** (`src/pages/admin/Dashboard.tsx`):
- Importar `useRealtimeSubscription` do hook existente
- Adicionar 3 subscriptions realtime: `comandas`, `vendas_concluidas` e `pedidos`
- No callback `onChange`, invalidar as query keys relevantes (`comandas-hoje`, `vendas-concluidas-hoje`, `pedidos-count-hoje`, `recent-orders`, `daily-sales`)

**Migração SQL**: Habilitar realtime para `vendas_concluidas` e `comandas`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas_concluidas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
```

## 2. UpsellDialog (popup) na página Menu

**Problema**: O Menu.tsx usa `UpsellSection` inline no carrinho (pouco visível). O delivery já usa o `UpsellDialog` em popup.

**Solução** (`src/pages/Menu.tsx`):
- Substituir import de `UpsellSection` por `UpsellDialog`
- Adicionar estados `showUpsellDialog` e `upsellShown`
- Interceptar o botão "Enviar Pedido": se upsell não foi mostrado, abrir o `UpsellDialog`; senão, chamar `handleSendOrder`
- Remover o `UpsellSection` inline do Sheet
- Adicionar `<UpsellDialog>` com `onContinue={handleSendOrder}`

## 3. Notificações estilo WhatsApp para pedidos

**Problema**: Não há notificações visuais persistentes (badges/banners) quando novos pedidos chegam no painel admin.

**Solução**: Criar um componente de notificação flutuante no `AdminLayout` que mostra um badge/toast persistente estilo WhatsApp quando chegam novos pedidos (salão e delivery).

### Novo componente: `src/components/admin/OrderNotificationBadge.tsx`
- Usa realtime subscriptions para `pedidos` (INSERT) e `pedidos_delivery` (INSERT)
- Mantém um contador de pedidos não visualizados
- Exibe um badge flutuante animado (estilo WhatsApp) no canto inferior direito com:
  - Ícone de sino com badge numérico
  - Preview do último pedido (tipo, mesa/endereço)
  - Som de notificação ao receber
  - Botão para marcar como visto / navegar para pedidos
- Ao clicar, navega para `/admin/pedidos` ou `/admin/delivery`
- O badge desaparece ao visitar a página de pedidos

### Integração no `AdminLayout.tsx`:
- Importar e renderizar `<OrderNotificationBadge />` dentro do layout, posicionado como `fixed bottom-4 right-4`

**Total: 3 arquivos alterados, 1 arquivo criado, 1 migração SQL**

