

# Reestruturacao do Fluxo de Login

## Problema Atual

A tela `/auth` (AuthChoice) mostra 3 opcoes: "Sou Cliente", "Sou Restaurante" e "Sou Funcionario". Isso e confuso porque:
1. Clientes nao deveriam ver opcoes de restaurante/funcionario
2. "Sou Restaurante" e "Sou Funcionario" levam para a mesma tela (`/auth/restaurante`)
3. A pagina de escolha adiciona um passo desnecessario

## Solucao

Simplificar para **dois fluxos separados** com acesso direto:

```text
/auth          -->  Login/Cadastro para Restaurantes e Funcionarios (tela atual Auth.tsx)
/auth/cliente  -->  Login/Cadastro para Clientes (tela atual AuthCliente.tsx, ja existe)
```

Remover a pagina intermediaria `AuthChoice` completamente.

### Alteracoes

| Arquivo | O que muda |
|---------|------------|
| `src/App.tsx` | Rota `/auth` aponta diretamente para `Auth` (login restaurante/funcionario). Remover import de `AuthChoice`. |
| `src/pages/Index.tsx` | Usuarios nao logados redirecionam para `/auth` (staff) - comportamento ja existente, sem mudanca. |
| `src/pages/AuthChoice.tsx` | Arquivo removido (nao sera mais usado). |
| `src/pages/Auth.tsx` | Adicionar um link "Sou cliente? Acesse aqui" no rodape para direcionar clientes perdidos para `/auth/cliente`. |
| `src/pages/AuthCliente.tsx` | Adicionar um link "Sou restaurante/funcionario? Acesse aqui" no rodape para direcionar para `/auth`. Adicionar opcao "Esqueci minha senha". |

### Detalhes Tecnicos

**App.tsx - Rotas**
```text
ANTES:
  /auth              -> AuthChoice (pagina de escolha)
  /auth/cliente      -> AuthCliente
  /auth/restaurante  -> Auth

DEPOIS:
  /auth              -> Auth (login direto para restaurante/funcionario)
  /auth/cliente      -> AuthCliente (login direto para clientes)
  /auth/restaurante  -> removido (nao precisa mais)
```

**Auth.tsx - Rodape**
Adicionar link discreto abaixo do card:
```text
"E cliente? Faca seus pedidos aqui" -> navega para /auth/cliente
```

**AuthCliente.tsx - Rodape e melhorias**
Adicionar link discreto:
```text
"E restaurante ou funcionario? Acesse aqui" -> navega para /auth
```
Adicionar botao "Esqueci minha senha" (igual ao Auth.tsx) para clientes tambem poderem recuperar senha.

### Fluxo Resultante

```text
Usuario abre o app (/)
  |
  +-- Staff logado -> /admin (dashboard)
  +-- Cliente logado -> /delivery ou /menu
  +-- Nao logado -> /auth (login restaurante/funcionario)
                      |
                      +-- Link "Sou cliente" -> /auth/cliente
```

Clientes que acessam via delivery (`/delivery/auth`) continuam usando a tela dedicada que ja existe.

