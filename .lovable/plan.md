

# Correcao: App Sempre Abrir no Dashboard para Administradores

## Problema

Quando o usuario abre o app no celular, ele e redirecionado para o cardapio ou para a pagina de cadastrar empresa, em vez de ir direto para o dashboard.

**Causa raiz**: No `AuthContext.tsx`, o estado `loading` muda para `false` ANTES do perfil do usuario ser carregado. Isso acontece porque o `fetchProfile` e chamado via `setTimeout` (linha 88) e o `setLoading(false)` executa imediatamente (linha 93).

Resultado: quando o `Index.tsx` verifica o estado, `loading=false` mas `profile=null`, entao:
- `!profile?.empresa_id` e `true` -> redireciona para onboarding (cadastrar empresa)
- Ou em outro momento, o profile carrega parcialmente e redireciona para o cardapio

## Solucao

### 1. Corrigir AuthContext.tsx - Aguardar profile antes de liberar loading

Alterar a logica para que `setLoading(false)` so seja chamado APOS o `fetchProfile` terminar. Remover o `setTimeout` e usar `await` direto.

```
// ANTES (quebrado):
setTimeout(() => fetchProfile(session.user.id), 0);
setLoading(false);

// DEPOIS (correto):
await fetchProfile(session.user.id);
setLoading(false);
```

Mesma correcao no bloco `getSession()` (linhas 98-107).

### 2. Verificar Index.tsx - Logica de redirecionamento

A logica atual do Index.tsx esta correta em si:
- Usuario com role staff -> `/admin`
- Usuario sem empresa -> `/admin/onboarding`
- Usuario cliente -> `/menu`

O problema e apenas que o `profile` chega como `null` por causa do timing. Com a correcao do AuthContext, o profile estara disponivel quando o Index verificar.

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | Aguardar `fetchProfile` completar antes de `setLoading(false)` em ambos os locais (onAuthStateChange e getSession) |

## Resultado Esperado

1. Usuario abre o app
2. Tela de loading aparece enquanto autenticacao E profile sao carregados
3. Profile carrega com `empresa_id` e `role=proprietario`
4. Index redireciona para `/admin` (dashboard)
5. Sem flicker, sem redirecionamento errado
