

# Correções: Painel Entregador + Notificação de Atualização + Build Errors

## Problemas Identificados

### 1. Painel Entregador lento e sem permissão GPS
O painel depende de `profile?.empresa_id` do `useAuth()`. Para motoboys, o perfil pode não ter `empresa_id` populado, fazendo a query nunca executar (`enabled: !!profile?.empresa_id`), resultando em loading infinito. Além disso, o GPS só é ativado ao clicar "Saiu para Entrega" — não há prompt automático de permissão ao abrir o painel.

**Solução:**
- Buscar `empresa_id` via `user_roles` caso `profile.empresa_id` seja null (motoboys podem ter a associação apenas na tabela `user_roles`)
- Adicionar botão explícito "Ativar GPS" no card de status do GPS, independente de ter pedido, para que o navegador solicite permissão imediatamente
- Reduzir timeout do GPS de 15s para 10s

### 2. Notificação de atualização aparecendo múltiplas vezes
O `UpdateNotification` usa `updateDetectedRef` para controlar duplicatas, mas o ref é resetado quando o componente remonta (navegação entre páginas). O `sessionStorage('update_notification_shown')` deveria prevenir isso, mas a verificação inicial com `markUpdateAvailable()` pode ser chamada antes do check de `alreadyShown` em certos caminhos de código.

**Solução:**
- Mover o check de `alreadyShown` para dentro de `markUpdateAvailable()` como primeira verificação
- Garantir que `updateDetectedRef` seja inicializado com base no `sessionStorage` para sobreviver a remontagens
- Manter o delay de 10 segundos já existente

### 3. Build Errors (bloqueantes)
- `canAccessEntregador` não existe no tipo `UserRoleData` — adicionar ao interface
- `process.env` em `ErrorBoundary.tsx` — substituir por `import.meta.env`
- `NodeJS` namespace em 3 arquivos — substituir por `ReturnType<typeof setTimeout>`
- `parseError` tipo `unknown` em `send-email/index.ts` — adicionar type assertion

## Implementação

### Arquivo: `src/hooks/useUserRole.ts`
- Adicionar `canAccessEntregador: boolean` ao interface `UserRoleData` (linha ~37)

### Arquivo: `src/components/ErrorBoundary.tsx`
- Substituir `process.env.NODE_ENV !== 'production'` por `import.meta.env.DEV`

### Arquivo: `src/pages/DeliveryRestaurant.tsx`, `src/pages/admin/Garcom.tsx`, `src/pages/admin/Pedidos.tsx`
- Substituir `NodeJS.Timeout` por `ReturnType<typeof setTimeout>`

### Arquivo: `supabase/functions/send-email/index.ts`
- Adicionar `(parseError as Error).message` nas duas linhas com erro

### Arquivo: `src/pages/admin/EntregadorPanel.tsx`
- Adicionar fallback para buscar `empresa_id` via `user_roles` quando `profile.empresa_id` é null
- Adicionar botão "Ativar GPS" no card de status para solicitar permissão do navegador ao abrir o painel

### Arquivo: `src/components/UpdateNotification.tsx`
- Inicializar `updateDetectedRef` com `sessionStorage.getItem('update_notification_shown') === '1'`
- Mover check de `alreadyShown` para dentro de `markUpdateAvailable()`

