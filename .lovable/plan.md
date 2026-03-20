

# Análise: Status das 3 solicitações

## 1. Filtro Delivery (toggle desativar/ativar) — ✅ Já implementado

O arquivo `src/hooks/useDeliveryRestaurants.ts` já possui:
- Default `delivery_ativo: false` para restaurantes sem config (linha 39)
- Filtro `.filter(e => e.config.delivery_ativo === true)` (linha 46)
- A política RLS de `config_delivery` para SELECT público já filtra `delivery_ativo = true`

**Possível problema**: O admin precisa clicar **"Salvar Configurações"** após desativar o toggle no `DeliveryConfigSection`. O toggle sozinho não salva automaticamente — ele apenas marca `hasChanges = true`. Se o admin desativa o toggle e sai da página sem salvar, a mudança não persiste.

**Melhoria proposta**: Tornar o toggle de `delivery_ativo` com salvamento automático (sem precisar clicar no botão), para que a mudança seja imediata. Isso envolve chamar a mutation diretamente ao alterar o toggle.

### Arquivo: `src/components/admin/DeliveryConfigSection.tsx`
- Adicionar uma função `handleDeliveryToggle` que salva imediatamente no banco ao mudar o switch de `delivery_ativo`, sem precisar clicar em "Salvar"

## 2. Sidebar compacto (ícones) — ✅ Já implementado

O `AdminSidebar.tsx` já usa `collapsible="icon"`, detecta `collapsed` via `useSidebar()`, oculta textos condicionalmente, e mostra tooltips. O `AdminLayout.tsx` já conecta o toggle de "Menu compacto" das Configurações ao estado do sidebar.

**Nenhuma alteração necessária.**

## 3. Barra de atualização em produção — ✅ Já implementado

O `UpdateNotification.tsx` já usa `__BUILD_TIMESTAMP__` e verificação por fetch com cache-busting. O `vite.config.ts` define `__BUILD_TIMESTAMP__`.

**Nota**: A barra só aparece quando há uma nova versão deployada APÓS a versão atual. Se o usuário nunca viu a barra, pode ser que o Service Worker está cacheando o `index.html`. 

**Melhoria proposta**: Nenhuma alteração de código — a barra aparecerá automaticamente após o próximo deploy quando o hash dos assets mudar.

---

## Resumo de alterações

Apenas **1 mudança real** é necessária:

### `src/components/admin/DeliveryConfigSection.tsx`
- Ao alternar o toggle `delivery_ativo`, salvar automaticamente no banco (sem exigir clique em "Salvar Configurações")
- Isso garante que o restaurante desapareça/apareça imediatamente na página de delivery

Total: 1 arquivo, ~15 linhas alteradas.

