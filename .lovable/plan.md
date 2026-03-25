

# Plano: Upsell Inteligente em Popup (Delivery)

## Problema
O upsell atual fica embutido no Sheet de checkout, misturado com os outros campos. É fácil de ignorar.

## Solução
Criar um **Dialog (popup)** de upsell que aparece automaticamente quando o cliente clica em "Finalizar Pedido", **antes** de processar o checkout. O popup mostra sugestões de acompanhamentos de forma chamativa. O cliente pode adicionar itens ou pular direto para o pagamento.

## Alterações

### 1. Criar componente `UpsellDialog` (`src/components/delivery/UpsellDialog.tsx`)
- Dialog fullscreen no mobile, modal no desktop
- Título chamativo com ícone (ex: "Que tal completar seu pedido?")
- Grid de produtos sugeridos com imagem, nome, preço e botão "Adicionar"
- Botão principal "Continuar sem adicionar" e indicador de itens adicionados
- Reutiliza a mesma lógica de busca do `UpsellSection` (categorias de bebidas/acompanhamentos/sobremesas)

### 2. Integrar no fluxo de checkout (`src/pages/DeliveryRestaurant.tsx`)
- Adicionar estado `showUpsellDialog`
- Quando o cliente clica em "Finalizar Pedido", em vez de chamar `handleCheckout` diretamente:
  - Se existem produtos de upsell disponíveis → abrir o popup primeiro
  - O popup tem botão "Continuar" que fecha o dialog e chama `handleCheckout`
- Remover o `UpsellSection` inline do Sheet (substituído pelo popup)

**Total: 1 arquivo criado, 1 arquivo alterado**

