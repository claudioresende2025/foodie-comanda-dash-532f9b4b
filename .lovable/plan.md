
# Correcao: App Travado no "Carregando..."

## Problema

A correcao anterior adicionou `await fetchProfile()` dentro do callback `onAuthStateChange`. O Supabase nao suporta bem callbacks assincronos longos neste listener -- o evento `INITIAL_SESSION` trava e `setLoading(false)` nunca executa.

## Causa Raiz

O `onAuthStateChange` dispara o evento `INITIAL_SESSION` sincronamente durante o setup. Quando o callback e `async` com `await` de uma chamada de rede (fetchProfile), o Supabase fica esperando, e o `getSession()` logo abaixo tambem depende do mesmo estado interno, criando um deadlock.

## Solucao

Manter o `onAuthStateChange` leve (sem await de rede) e usar apenas o `getSession` para o carregamento inicial com profile. O listener so precisa atualizar estado para mudancas POSTERIORES (login, logout, troca de token).

### Alteracao em `src/contexts/AuthContext.tsx`

```
onAuthStateChange(async (event, session) => {
  // PASSWORD_RECOVERY continua igual
  setSession(session);
  setUser(session?.user ?? null);

  if (session?.user) {
    // Nao bloquear com await - usar .then() para nao travar o listener
    fetchProfile(session.user.id);
  } else {
    setProfile(null);
  }
  // NAO setar loading aqui - deixar o getSession controlar o loading inicial
});

// getSession continua com await (este sim pode ser async sem problema)
supabase.auth.getSession().then(async ({ data: { session } }) => {
  setSession(session);
  setUser(session?.user ?? null);

  if (session?.user) {
    await fetchProfile(session.user.id); // await aqui e seguro
  }

  setLoading(false); // unico ponto que libera o loading
});
```

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | Remover `await` do `onAuthStateChange` e remover `setLoading(false)` de dentro dele. Manter `await` apenas no `getSession`. |

## Resultado Esperado

1. App abre -> mostra loading
2. `getSession` carrega sessao e profile (com await)
3. `setLoading(false)` executa apos profile estar pronto
4. Index.tsx redireciona corretamente para `/admin`
5. Sem travamento, sem flickering
