

# Correções de Segurança + Logout por Inatividade

## Problemas Identificados

### Criticos (ERROR)
1. **Tabela `empresas` expõe CNPJ, chave_pix publicamente** - Dados sensíveis de negócio acessíveis sem autenticação
2. **Tabela `comandas` expõe telefone/nome de clientes** - Dados pessoais públicos (violação LGPD)
3. **Tabela `reservas` expõe contato de clientes** - Nome, telefone, email públicos
4. **Tabela `itens_delivery` públicamente legível** - Dados de pedidos acessíveis
5. **`config_fiscal` pode expor credenciais fiscais** - API tokens, senhas de certificado
6. **Proteção contra senhas vazadas desabilitada**

### Importantes (WARN)
7. **7 políticas RLS com `WITH CHECK (true)` ou `USING (true)`** em operações INSERT/UPDATE - Permissivas demais
8. **Edge function `delete-user` sem autenticação** - Qualquer pessoa pode deletar usuários
9. **`create-delivery-checkout` aceita total do cliente** - Validação recalcula do orderData do cliente, mas orderData também vem do cliente

### Funcionalidade Solicitada
10. **Logout automático após 1 hora de inatividade**

## Plano de Implementação

### 1. Criar hook `useInactivityTimeout`
- Arquivo: `src/hooks/useInactivityTimeout.ts`
- Monitora eventos `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll` com throttle de 30s
- Timeout de 1 hora (3.600.000ms)
- Ao expirar: `signOut()` + redirect para `/auth` + toast "Sessão expirada"
- Sincroniza entre abas via `localStorage` key `lastActivity`

### 2. Integrar no AuthContext
- Chamar `useInactivityTimeout` no `AuthProvider` quando `user !== null`

### 3. Migração SQL: Restringir dados sensíveis em `empresas`
- Remover política `Public can view empresa for menu` que expõe tudo
- Criar política SELECT pública que expõe **apenas** `id, nome_fantasia, logo_url, endereco_completo` (via view ou RLS com coluna filtering - usar a function `get_empresa_public_info` já existente)
- Manter acesso completo para staff/proprietário

### 4. Migração SQL: Restringir `comandas`
- Remover políticas `Public can view comanda by session` e `Public can update comanda total` com `USING(true)` / `WITH CHECK(true)`
- Substituir por políticas que exigem `qr_code_sessao` matching ou autenticação staff

### 5. Migração SQL: Restringir `itens_delivery`
- Remover `Public can view delivery items` com `USING(true)`
- Substituir por política que permite visualização apenas para o dono do pedido ou staff da empresa

### 6. Proteger edge function `delete-user`
- Adicionar verificação de autenticação (Bearer token)
- Verificar que o chamador é proprietário da empresa do usuário alvo ou super_admin
- Adicionar CORS headers

### 7. Habilitar proteção contra senhas vazadas
- Usar configuração de auth para ativar leaked password protection

### 8. Restringir `itens_delivery` INSERT
- A política `Allow anon insert itens_delivery` com `WITH CHECK(true)` permite inserts anônimos
- Restringir para authenticated users

## Detalhes Técnicos

### Hook de inatividade
- Eventos registrados no `document` com `{ passive: true }`
- Throttle via timestamp comparison (sem dependência externa)
- Timer reiniciado a cada interação (throttled)
- `localStorage.setItem('lastActivity', Date.now())` para sincronização entre abas
- Cleanup completo no unmount

### Empresas - Abordagem RLS
A function `get_empresa_public_info()` já existe e retorna apenas dados públicos. A política SELECT pública será mantida mas limitada. Como RLS não suporta column-level filtering nativo, a abordagem será:
- Manter SELECT público para `empresas` (necessário para cardápio/delivery)
- Criar migration para remover `chave_pix` da exposição pública criando uma view segura
- Ou: aceitar que `empresas` é público e mover `chave_pix` para config separada (mais invasivo)
- **Abordagem escolhida**: Restringir SELECT público para usar a function existente nos componentes de delivery, e restringir a policy SELECT para não expor `cnpj`, `chave_pix`, `inscricao_estadual` via RLS policy mais granular

### delete-user - Proteção
```typescript
// Verificar auth token
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');
const { data: { user: caller } } = await supabase.auth.getUser(token);
// Verificar se caller é proprietário ou super_admin
```

