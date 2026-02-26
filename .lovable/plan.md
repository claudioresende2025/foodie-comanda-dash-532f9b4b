

# Fix: Super Admin bloqueado pela tela de assinatura

## Problema
A tabela `super_admins` está vazia. O usuário `claudinhoresendemoura@gmail.com` (id: `fa73ea31-66f8-4e98-a5ec-0385526833a4`) não está registrado como super admin. Como resultado:
1. O `SubscriptionGuard` não o reconhece como super admin
2. A empresa não tem assinatura ativa
3. O sistema bloqueia o acesso com a tela "Escolha um Plano"

## Solução

### 1. Inserir o usuário na tabela `super_admins` (migration SQL)
```sql
INSERT INTO super_admins (user_id, ativo)
VALUES ('fa73ea31-66f8-4e98-a5ec-0385526833a4', true)
ON CONFLICT DO NOTHING;
```

Isso resolverá o problema porque o `SubscriptionGuard` já tem a lógica para liberar super admins (linhas 162-178), e o `useUserRole` também já verifica `super_admins` para definir `isSuperAdmin = true`.

### Resultado esperado
- Login como super admin → acesso liberado sem precisar de assinatura
- Menu lateral mostra "Administração" acima de "Configurações"
- Footer do sidebar exibe badge "Super Admin"
- Nenhuma alteração de código necessária — apenas o registro no banco

