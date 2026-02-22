

# Melhorias na Pagina de Autenticacao (Auth)

## Resumo
Corrigir 5 problemas na pagina Auth: criar pagina `/reset-password` (sem ela o reset de senha nao funciona), substituir modal manual por Dialog acessivel, adicionar toggle de visibilidade de senha, tratar erro `EMAIL_NOT_CONFIRMED`, e corrigir o `redirectTo` do reset.

---

## 1. Criar pagina `/reset-password`

**Problema:** Hoje o `redirectTo` aponta para `/auth`, o que faz o usuario ser logado automaticamente sem definir nova senha. E preciso uma pagina dedicada.

**O que sera feito:**
- Criar `src/pages/ResetPassword.tsx` com formulario para nova senha
- Verificar presenca de `type=recovery` no hash da URL
- Chamar `supabase.auth.updateUser({ password })` ao submeter
- Adicionar rota publica `/reset-password` no `App.tsx`

---

## 2. Corrigir `redirectTo` no reset de senha

**Problema:** Linha 168 do Auth.tsx aponta para `/auth` em vez de `/reset-password`.

**Correcao:**
```
redirectTo: `${window.location.origin}/reset-password`
```

---

## 3. Substituir modal manual por Dialog

**Problema:** O modal "Esqueci minha senha" (linhas 260-303) usa `div` com `fixed inset-0`, sem acessibilidade, sem fechar com Escape, sem trap de foco.

**Correcao:** Substituir por componente `Dialog` do Radix UI que ja existe no projeto (`@/components/ui/dialog`).

---

## 4. Adicionar toggle de visibilidade de senha

**Problema:** Os campos de senha nao tem botao para mostrar/ocultar a senha digitada.

**Correcao:** Adicionar icone `Eye`/`EyeOff` do lucide-react ao lado do campo de senha (login e cadastro), alternando entre `type="password"` e `type="text"`.

---

## 5. Tratar erro `EMAIL_NOT_CONFIRMED`

**Problema:** Se o email nao foi confirmado, a mensagem generica "Erro ao fazer login" aparece, sem orientar o usuario.

**Correcao:** Adicionar verificacao no `handleLogin`:
```
if (error.message.includes('Email not confirmed')) {
  toast.error('Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.');
}
```

---

## Secao Tecnica

### Novo arquivo: `src/pages/ResetPassword.tsx`
- Estados: `password`, `confirmPassword`, `isLoading`, `isValid`
- No `useEffect`, verificar hash da URL para `type=recovery`
- Validar senha minima 6 caracteres e confirmacao igual
- Chamar `supabase.auth.updateUser({ password: newPassword })`
- Redirecionar para `/auth` apos sucesso com toast de confirmacao
- UI: Card centralizado com 2 campos de senha + botao, toggle de visibilidade

### Alteracoes em `src/App.tsx`
- Importar `ResetPassword` de `@/pages/ResetPassword`
- Adicionar rota: `<Route path="/reset-password" element={<ResetPassword />} />`

### Alteracoes em `src/pages/Auth.tsx`
- Linha 168: trocar `/auth` por `/reset-password` no `redirectTo`
- Linhas 260-303: substituir div manual por `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
- Adicionar estado `showPassword` e icone `Eye`/`EyeOff` nos campos de senha (login e signup)
- Linhas 121-126: adicionar tratamento para `Email not confirmed`
- Importar `Eye`, `EyeOff` do lucide-react e componentes Dialog

### Arquivos afetados
- `src/pages/ResetPassword.tsx` (novo)
- `src/App.tsx` (1 import + 1 rota)
- `src/pages/Auth.tsx` (4 alteracoes)

