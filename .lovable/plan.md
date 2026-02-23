

# Correcao do Fluxo de Reset de Senha

## Problema
Ao clicar no link de recuperacao de senha no e-mail, o usuario ve "link invalido ou expirado". Isso acontece por dois motivos:

1. **Redirecionamento com recarga completa**: O `AuthContext` intercepta o evento `PASSWORD_RECOVERY` e faz `window.location.href = '/reset-password'`, o que recarrega toda a pagina e perde a sessao de recuperacao
2. **Sessao perdida**: A pagina `ResetPassword.tsx` verifica `getSession()` no carregamento, mas a sessao ainda nao foi estabelecida apos o redirecionamento

## Solucao

### 1. Corrigir o AuthContext (src/contexts/AuthContext.tsx)
- Trocar `window.location.href = '/reset-password'` por navegacao via React Router sem recarregar a pagina
- Isso preserva a sessao de recuperacao em memoria

### 2. Corrigir a pagina ResetPassword (src/pages/ResetPassword.tsx)
- Ao inves de verificar apenas `getSession()` no carregamento, tambem escutar o evento `onAuthStateChange` para capturar o evento `PASSWORD_RECOVERY`
- Adicionar um pequeno delay para dar tempo da sessao ser estabelecida
- Apos redefinir a senha com sucesso, redirecionar para `/auth` (rota que existe) em vez de `/auth/restaurante` (rota que nao existe)

### 3. Corrigir redirecionamento pos-reset
- `ResetPassword.tsx` redireciona para `/auth/restaurante` que NAO existe nas rotas do App. A rota correta e `/auth`

## Detalhes Tecnicos

**AuthContext.tsx** - Usar `navigate` do React Router:
- Importar e usar `useNavigate` nao e possivel fora de componente de rota
- Alternativa: manter `window.location.href` mas garantir que a sessao seja preservada
- Melhor abordagem: setar um flag no sessionStorage antes de redirecionar, e o ResetPassword usa esse flag + onAuthStateChange para validar

**ResetPassword.tsx** - Melhorar validacao de sessao:
- Usar `onAuthStateChange` para escutar eventos de autenticacao
- Aceitar tanto sessao existente quanto evento `PASSWORD_RECOVERY`
- Corrigir navegacao pos-reset de `/auth/restaurante` para `/auth`
- Adicionar tratamento para quando a sessao demora a ser estabelecida

**Auth.tsx** - O `redirectTo` no `resetPasswordForEmail` ja usa `window.location.origin` corretamente, nao precisa de alteracao.

### Arquivos a serem modificados:
1. `src/contexts/AuthContext.tsx` - Ajustar handling do PASSWORD_RECOVERY
2. `src/pages/ResetPassword.tsx` - Melhorar validacao de sessao e corrigir rotas
