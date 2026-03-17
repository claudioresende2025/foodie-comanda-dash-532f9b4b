

# Atualizar branding para "Food Comanda Pro" em todo o projeto

## Locais que precisam de alteração

### 1. `src/pages/Auth.tsx` (linha 400)
- Atual: `Food<span className="text-accent">Comanda</span>`
- Alterar para: `Food <span className="text-accent">Comanda</span> Pro`

### 2. `src/components/admin/AdminSidebar.tsx` (linhas 204 e 229)
- Atual: `FoodComanda`
- Alterar para: `Food Comanda Pro`

### 3. `src/pages/admin/Configuracoes.tsx` (linha 152)
- Atual: `FoodComanda - Sistema de Gestão`
- Alterar para: `Food Comanda Pro - Sistema de Gestão`

### 4. `src/pages/LandingRestaurantes.tsx` (linhas 75, 275, 295)
- Linha 75: `Food Comanda` → `Food Comanda Pro`
- Linha 275: `Food Comanda` → `Food Comanda Pro`
- Linha 295: `© Food Comanda.` → `© Food Comanda Pro.`

### 5. `index.html` (linha 16)
- Atual: `apple-mobile-web-app-title` = `Food Comanda`
- Alterar para: `Food Comanda Pro`

### 6. `public/manifest-admin.json` (linha 2)
- Atual: `Food Comanda Admin`
- Alterar para: `Food Comanda Pro Admin`

Total: 8 alterações em 6 arquivos. Todas as outras referências já estão com "Food Comanda Pro".

