

# Ajustar Sidebar: Administração no menu principal + Badge Super Admin

## Alterações

### 1. `src/components/admin/AdminSidebar.tsx`

**Menu "Administração" acima de "Configurações":**
- Remover a seção separada "Sistema" (linhas 264-285) que hoje renderiza o link Administração
- Inserir o item "Administração" diretamente no array `allMenuItems`, antes de "Configurações" (entre "assinatura" e "configuracoes")
- Adicionar `'administracao'` ao tipo `MenuItemKey` e ao `permissionMap` (vinculado a `isSuperAdmin`)
- No `visibleMenuItems`, o item só aparecerá para super admins pois staff/proprietário/gerente sem permissão serão filtrados

**Badge "Super Admin" no footer:**
- Na área do footer onde exibe a role do usuário (linhas 302-306), adicionar condição: se `isSuperAdmin`, mostrar badge "Super Admin" em vez da role normal

### Resultado
- "Administração" aparece no menu principal logo acima de "Configurações", apenas para super admins
- O footer do sidebar mostra "Super Admin" como badge quando o usuário é super admin

