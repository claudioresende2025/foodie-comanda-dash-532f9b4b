

# Sidebar compactado: mostrar apenas ícones

## Problema
Quando o sidebar é recolhido, ele não usa o modo `collapsible="icon"` — então simplesmente fecha ao invés de mostrar uma faixa estreita com apenas os ícones.

## Solução

### Arquivo: `src/components/admin/AdminSidebar.tsx`

1. **Adicionar `collapsible="icon"`** no componente `<Sidebar>` (linhas 197, 222) para que ao recolher ele mostre apenas os ícones numa faixa estreita.

2. **Usar `useSidebar()` para detectar estado colapsado** e ocultar textos condicionalmente:
   - No **header** (linhas 224-233): ocultar o texto "Food Comanda Pro" / "Painel Admin" quando colapsado, mostrando apenas o ícone `Utensils`.
   - Nos **menu items** (linhas 242-280): os `<span>` com o título já são tratados pelo modo `icon` do Sidebar automaticamente.
   - No **footer** (linhas 290-328): ocultar o bloco completo de email/role/botões quando colapsado, mostrando apenas o avatar com a inicial ou um botão de logout com ícone.

3. **Adicionar `SidebarMenuButton` com tooltip** — no modo ícone, o Shadcn Sidebar já suporta tooltips automáticos via a prop `tooltip` no `SidebarMenuButton`, mostrando o nome do item ao passar o mouse.

### Resultado
- Sidebar expandido: comportamento atual (ícone + texto)
- Sidebar recolhido: faixa estreita (~48px) com apenas os ícones dos menus e tooltips ao hover

