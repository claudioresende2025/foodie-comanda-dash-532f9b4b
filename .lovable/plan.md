
# Dados Fictícios para Teste + Correção da Sidebar

## Parte 1: Dados Fictícios no Banco de Dados

O usuário `usercontratada@gmail.com` (id: `47649b1e-...`) não tem empresa vinculada nem dados de teste. Será necessário criar dados completos para um teste funcional.

### Dados a serem criados (via SQL insert):

1. **Empresa**: "Restaurante Sabor & Arte" vinculada ao usuário
2. **Profile update**: Vincular `empresa_id` no perfil do usuário
3. **User role**: Criar role `proprietario` para o usuário
4. **Assinatura ativa**: Criar assinatura com trial válido (trial_fim = 30 dias no futuro) usando plano Bronze
5. **Categorias** (4): Entradas, Pratos Principais, Bebidas, Sobremesas
6. **Produtos** (8-10): 2-3 produtos por categoria com nomes, preços e descrições realistas
7. **Mesas** (5): Mesas numeradas de 1 a 5 com capacidades variadas
8. **Config Delivery**: Configuração básica de delivery ativa

### Execução
- Usar a ferramenta de insert do banco para cada grupo de dados
- Garantir que todos os `empresa_id` referenciam a nova empresa

---

## Parte 2: Correção da Barra de Rolagem na Sidebar

### Problema
O componente `SidebarContent` em `src/components/ui/sidebar.tsx` (linha 334) tem a classe `overflow-auto`, que exibe uma barra de rolagem quando o conteúdo excede a altura disponível.

### Solução
Alterar a classe no `SidebarContent` para ocultar a scrollbar visualmente mas manter a funcionalidade de scroll:

**Arquivo: `src/components/admin/AdminSidebar.tsx`**
- Passar `className="overflow-y-auto scrollbar-hide"` no `SidebarContent`

**Arquivo: `src/index.css`**
- Adicionar CSS utilitário para ocultar a scrollbar:
```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

Isso mantém a possibilidade de scroll por toque/trackpad mas remove a barra visível.

---

## Arquivos afetados
- `src/components/admin/AdminSidebar.tsx` (classe no SidebarContent)
- `src/index.css` (utilitário CSS scrollbar-hide)
- Banco de dados: inserts de dados fictícios (empresa, categorias, produtos, mesas, assinatura, config_delivery)
