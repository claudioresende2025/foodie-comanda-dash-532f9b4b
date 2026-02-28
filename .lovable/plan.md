

# URL personalizada com nome do restaurante na página de login

## Problema
Atualmente a URL de login é fixa: `/auth`. O usuário quer que a URL mostre o nome do restaurante, ex: `/auth/Taz%20mania`.

## Abordagem
Usar um parâmetro de rota opcional para buscar a empresa pelo `nome_fantasia` e personalizar a página de login com o nome/logo do restaurante.

## Correções

### 1. `src/App.tsx`
- Adicionar rota `/auth/:empresaNome` apontando para o componente `Auth`

### 2. `src/pages/Auth.tsx`
- Ler o parâmetro `:empresaNome` via `useParams()`
- Buscar a empresa no banco usando `nome_fantasia` (busca case-insensitive via `.ilike()`)
- Exibir o nome e logo do restaurante no topo da página quando encontrado
- Após login, redirecionar para o menu/admin da empresa correta

### 3. `src/components/CardapioLink.tsx`
- Atualizar o link gerado para incluir o formato `/auth/NomeDoRestaurante` como opção de compartilhamento

## Detalhes Técnicos
- A busca será feita com `supabase.from('empresas').select('id, nome_fantasia, logo_url').ilike('nome_fantasia', empresaNome)` usando o valor decodificado da URL
- Se o restaurante não for encontrado, a página funciona normalmente como `/auth` genérico
- A rota sem parâmetro (`/auth`) continua funcionando como antes

