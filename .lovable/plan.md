

# Ocultar "Administração" para não-super-admins

## Problema
Atualmente, proprietários e gerentes veem o item "Administração" com cadeado. Ele deve ser completamente invisível para qualquer usuário que não seja super admin.

## Alteração

**`src/components/admin/AdminSidebar.tsx` — linha 170-173**

Alterar o filtro `visibleMenuItems` para sempre excluir "Administração" quando o usuário não é super admin:

```typescript
const visibleMenuItems = useMemo(() => {
  if (isProprietario || isGerente || isSuperAdmin) {
    // Filtrar 'administracao' se não for super admin
    return allMenuItems.filter(item => item.key !== 'administracao' || isSuperAdmin);
  }
  return allMenuItems.filter(item => permissionMap[item.key]);
}, [/* deps existentes */]);
```

Resultado: apenas super admins verão a opção "Administração" no menu.

