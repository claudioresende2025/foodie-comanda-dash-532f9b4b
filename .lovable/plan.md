

# Correcao do Fluxo de Reset de Senha

## Problema
Quando o usuario clica no link de recuperacao de senha no e-mail:
1. Supabase processa o token e dispara evento `PASSWORD_RECOVERY` no `onAuthStateChange`
2. AuthContext seta o usuario como autenticado
3. O roteamento redireciona para `/admin` (porque o usuario agora esta logado)
4. A pagina `/reset-password` nunca e exibida
5. O toast "Link de recuperacao invalido ou expirado" aparece porque o hash ja foi consumido pelo Supabase

## Solucao

### 1. Interceptar evento `PASSWORD_RECOVERY` no AuthContext

No `src/contexts/AuthContext.tsx`, dentro do `onAuthStateChange` (linha 77), detectar o evento `PASSWORD_RECOVERY` e redirecionar para `/reset-password`:

```
if (event === 'PASSWORD_RECOVERY') {
  window.location.href = '/reset-password';
  return;
}
```

Isso garante que, antes de qualquer outra logica de roteamento, o usuario seja levado a pagina correta.

### 2. Ajustar ResetPassword.tsx para nao depender do hash

No `src/pages/ResetPassword.tsx`, o `useEffect` (linhas 20-29) atualmente verifica `type=recovery` no hash da URL. Como o Supabase ja consumiu o hash neste ponto, a verificacao deve mudar para:

- Verificar se existe uma sessao ativa (o Supabase ja autenticou o usuario via recovery)
- Remover a verificacao de hash, pois o redirecionamento vem do AuthContext que ja validou o evento `PASSWORD_RECOVERY`
- Usar `supabase.auth.getSession()` para confirmar que o usuario esta autenticado

```typescript
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      setIsValid(true);
    } else {
      toast.error('Link de recuperacao invalido ou expirado.');
      navigate('/auth/restaurante');
    }
  });
}, [navigate]);
```

## Arquivos afetados
- `src/contexts/AuthContext.tsx` (adicionar 3 linhas no onAuthStateChange)
- `src/pages/ResetPassword.tsx` (substituir useEffect de verificacao de hash)

## Resultado esperado
1. Usuario clica no link de reset no e-mail
2. Supabase processa o token, dispara `PASSWORD_RECOVERY`
3. AuthContext intercepta e redireciona para `/reset-password`
4. ResetPassword verifica a sessao ativa e exibe o formulario
5. Usuario define nova senha com sucesso
