

# Plano: Adicionar Upsell Inteligente na página Menu (cardápio do restaurante)

## Estado Atual

- **DeliveryRestaurant.tsx**: Já tem `UpsellSection` integrada (linha 1251-1270), aparecendo no checkout sheet quando o carrinho tem itens.
- **Menu.tsx**: **Não tem** nenhuma integração de upsell. O carrinho é renderizado em um Sheet (linhas 1260-1330) sem sugestões.

## Alteração

### `src/pages/Menu.tsx`
- Importar `UpsellSection` de `@/components/delivery/UpsellSection`
- Adicionar o componente dentro do Sheet do carrinho, logo após a lista de itens do carrinho (depois da linha 1317) e antes do bloco de total/botão enviar
- Passar `empresaId`, `cartProductIds` (IDs dos produtos no carrinho) e `onAddToCart` que chama a função `addToCart` existente

O `UpsellSection` já é genérico — busca produtos por categoria (bebidas, acompanhamentos, sobremesas) ou por menor preço. Funciona tanto para delivery quanto para o cardápio presencial.

**Total: 1 arquivo alterado**

