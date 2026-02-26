# Solicitações Pendentes para o Lovable

Data: 2026-02-25

Este documento contém todas as alterações que foram solicitadas e precisam ser aplicadas no Lovable.

---

## 1. CORREÇÃO DOS NOMES DOS PLANOS

### Arquivos: `src/pages/admin/Assinatura.tsx` e `src/pages/Planos.tsx`

**Alterar os nomes dos planos para:**
- "Plano Iniciante" → **"Plano Bronze (Iniciante)"**
- "Plano Profissional" → **"Plano Prata (Intermediário)"**  
- "Plano Enterprise" → **"Plano Ouro (Enterprise)"**

### Prompt para o Lovable:
```
Altere os nomes dos planos em Assinatura.tsx e Planos.tsx:
1. "Plano Iniciante" deve ser "Plano Bronze (Iniciante)"
2. "Plano Profissional" deve ser "Plano Prata (Intermediário)"
3. "Plano Enterprise" deve ser "Plano Ouro (Enterprise)"
```

---

## 2. RECURSOS DO PLANO PRATA

### Arquivo: `src/pages/admin/Assinatura.tsx`

**No Plano Prata (Profissional), os seguintes recursos devem aparecer como INCLUÍDOS (não bloqueados):**
- Estatísticas Delivery
- Marketing

### Prompt para o Lovable:
```
No arquivo Assinatura.tsx, no plano Prata (Profissional), altere os recursos:
- "Estatísticas Delivery" deve ter included: true
- "Marketing" deve ter included: true
```

---

## 3. OCULTAR BOTÕES EDITAR/EXCLUIR NO PLANO BRONZE (Mesas)

### Arquivo: `src/pages/admin/Mesas.tsx`

**Os botões de Editar e Excluir mesa só devem aparecer para planos Prata e Ouro.**
Usuários do plano Bronze não devem ver esses botões.

### Prompt para o Lovable:
```
No arquivo Mesas.tsx, oculte os botões de editar e excluir mesa para usuários do plano Bronze.
Apenas usuários dos planos Prata e Ouro devem ver esses botões.
Use a variável planoSlug do hook usePlanFeatures() para verificar.
Condição: só mostrar se planoSlug !== 'bronze'
```

---

## 4. LINK "ADMINISTRAÇÃO" NO MENU (Super Admin)

### Arquivo: `src/components/admin/AdminSidebar.tsx`

**Adicionar um link "Administração" no menu lateral que:**
- Só aparece para usuários super_admin
- Usa o ícone Shield
- Direciona para /super-admin

### Prompt para o Lovable:
```
No AdminSidebar.tsx, adicione um novo link de menu "Administração":
1. Importe o ícone Shield do lucide-react
2. Adicione um novo SidebarGroup após os outros menus
3. O link deve apontar para "/super-admin"
4. Use o ícone Shield
5. Só deve aparecer se isSuperAdmin for true (use useUserRole hook)
6. Título do grupo: "Sistema"
```

---

## 5. MELHORIAS NO PAINEL SUPER ADMIN

### Arquivo: `src/pages/SuperAdmin.tsx`

### 5.1 Reduzir tamanho do popup de edição
**O popup de edição de empresa deve ser menor:**
- max-width: md (em vez de 4xl)
- max-height: 85vh
- Usar ScrollArea para scroll interno

### 5.2 Adicionar Dashboard com estatísticas
**Adicionar seção no topo do painel com:**
- Total de empresas cadastradas
- Distribuição por plano (quantas empresas em cada plano)
- Empresas recentes (últimas 5 cadastradas)

### 5.3 Melhorar tabela de empresas
**A tabela deve mostrar:**
- Nome da empresa
- Email do proprietário
- Plano atual (com badge colorido)
- Status da assinatura
- Data de criação
- Ações (editar)

### 5.4 Mais campos no popup de edição
**O popup deve permitir editar:**
- Plano da empresa
- mesas_limit (limite de mesas)
- garcom_limit (limite de garçons)
- estatisticas (habilitar/desabilitar)
- caixa (habilitar/desabilitar)
- delivery (habilitar/desabilitar)
- marketing (habilitar/desabilitar)

### Prompt para o Lovable:
```
Melhore o painel SuperAdmin.tsx:

1. POPUP MENOR:
   - DialogContent com className="max-w-md max-h-[85vh]"
   - Use ScrollArea do shadcn para scroll interno

2. DASHBOARD NO TOPO:
   - Adicione cards mostrando: Total empresas, Empresas Bronze, Empresas Prata, Empresas Ouro
   - Adicione uma seção "Empresas Recentes" com as 5 últimas cadastradas

3. TABELA MELHORADA:
   - Colunas: Empresa, Email, Plano (badge), Status, Criado em, Ações
   - Badge colorido para cada plano: Bronze=amber, Prata=gray, Ouro=yellow

4. POPUP DE EDIÇÃO COM MAIS CAMPOS:
   - Select para escolher o plano (bronze, prata, ouro)
   - Input number para mesas_limit
   - Input number para garcom_limit  
   - Switch para estatisticas
   - Switch para caixa
   - Switch para delivery
   - Switch para marketing
   
   Use a tabela empresa_plano_overrides para salvar os overrides.
```

---

## 6. NOMES DOS PLANOS NO SUPER ADMIN

### Arquivo: `src/pages/SuperAdmin.tsx`

**Usar função helper para exibir nomes corretos:**

```typescript
const getPlanDisplayName = (slug: string | null) => {
  switch (slug) {
    case 'bronze': return 'Plano Bronze (Iniciante)';
    case 'prata': return 'Plano Prata (Intermediário)';
    case 'ouro': return 'Plano Ouro (Enterprise)';
    default: return 'Sem plano';
  }
};
```

---

## RESUMO DAS ALTERAÇÕES

| # | Descrição | Arquivo(s) | Prioridade |
|---|-----------|------------|------------|
| 1 | Corrigir nomes dos planos | Assinatura.tsx, Planos.tsx | Alta |
| 2 | Recursos Prata (Estatísticas + Marketing) | Assinatura.tsx | Alta |
| 3 | Ocultar editar/excluir para Bronze | Mesas.tsx | Média |
| 4 | Link Administração no menu | AdminSidebar.tsx | Alta |
| 5 | Melhorias SuperAdmin (popup, dashboard, tabela) | SuperAdmin.tsx | Média |
| 6 | Nomes planos no SuperAdmin | SuperAdmin.tsx | Baixa |

---

## COMO APLICAR NO LOVABLE

1. Abra o projeto no Lovable
2. Use o chat para enviar cada prompt acima, um de cada vez
3. Aguarde o Lovable processar cada alteração
4. Teste cada funcionalidade após a alteração
5. Faça commit das alterações no Lovable

**IMPORTANTE:** Aplique as alterações uma de cada vez para evitar conflitos.
