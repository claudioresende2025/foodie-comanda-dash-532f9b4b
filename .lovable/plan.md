

# Correção: Filtrar restaurantes com delivery desativado

## Problema
No `useDeliveryRestaurants.ts`, todas as empresas são exibidas independentemente do `delivery_ativo`. Além disso, o default quando não há config é `delivery_ativo: true`, fazendo restaurantes sem configuração aparecerem como ativos.

## Solução
Adicionar filtro na mesclagem (linha 48) para excluir restaurantes onde `config.delivery_ativo === false`. Restaurantes sem `config_delivery` cadastrada também devem ser ocultados (inverter o default de `true` para `false`).

### Arquivo: `src/hooks/useDeliveryRestaurants.ts`
- Alterar o default de `delivery_ativo` de `true` para `false` (linha 39) — restaurante sem config não aparece
- Após o `merged`, filtrar apenas os que têm `config.delivery_ativo === true` antes de chamar `setEmpresas`

Mudança de ~2 linhas, sem impacto em outras partes do sistema.

