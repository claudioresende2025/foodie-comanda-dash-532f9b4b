
# Avaliação do Estado Atual e Plano de Correções Pendentes

## Resumo Executivo

Após análise completa do código, identifiquei o **status atual de cada uma das 12 correções solicitadas**:

| # | Correção | Status | Observações |
|---|----------|--------|-------------|
| 1 | Impressão formato cupom não fiscal | ⚠️ PENDENTE | Usa `printKitchenOrder` que é para cozinha, não cupom fiscal |
| 2 | Cancelar comanda → mesa disponível | ⚠️ PENDENTE | Existe em `MesaQRCodeDialog.tsx` mas NÃO na página Caixa |
| 3 | Persistência de rota ao atualizar | ✅ PARCIAL | Lógica existe mas ainda mostra toast de erro |
| 4 | Erro cadastro Motoboy | ✅ RESOLVIDO | Enum `motoboy` já existe no banco de dados |
| 5 | Erro exclusão membro (email existe) | ⚠️ PENDENTE | Precisa revisar Edge Function e lógica de exclusão |
| 6 | Couver/Música ao vivo (pt-BR) | ⚠️ PENDENTE | Dias em inglês (mon, tue...) ao invés de português |
| 7 | Opção "Esqueci minha senha" | ⚠️ PENDENTE | Não existe na página Auth (só em DeliveryProfile) |
| 8 | Mensagem de permissão para staff | ⚠️ PENDENTE | Ainda mostra modal de upgrade com preços |
| 9 | Menu lateral filtrado por perfil | ⚠️ PENDENTE | Mostra todos os itens com cadeado ao invés de ocultar |
| 10 | Configurações para todos os perfis | ⚠️ PENDENTE | Acesso restrito a admin |
| 11 | Mostrar perfil no menu lateral | ⚠️ PENDENTE | Só mostra email parcial, sem indicar o perfil |
| 12 | Expandir popup novo produto | ⚠️ PENDENTE | Usa `max-w-lg` com scroll |

---

## Detalhamento das Correções Pendentes

### 1. Impressão Formato Cupom Não Fiscal (PENDENTE)

**Problema**: O código atual em `Caixa.tsx` linha 419-447 chama `printKitchenOrder()` que é uma função para pedidos de cozinha, não para cupom fiscal com valores.

**Estado Atual**:
```typescript
// src/utils/kitchenPrinter.ts - formato de COZINHA, não fiscal
receipt += centerText('*** NOVO PEDIDO ***', 40);  // Formato errado!
```

**Correção Necessária**: Criar nova função `printCaixaReceipt()` que inclua:
- Cabeçalho com dados do restaurante (nome, endereço, CNPJ)
- Número da mesa
- Itens com quantidade, valor unitário e subtotal
- Taxa de serviço (quando ativada)
- Total final
- Forma de pagamento

---

### 2. Cancelar Comanda na Página Caixa (PENDENTE)

**Problema**: A função `handleCancelarComanda` existe apenas em `MesaQRCodeDialog.tsx`, não na página Caixa.

**Correção Necessária**: Adicionar `cancelComandaMutation` em `Caixa.tsx` com:
- Botão "Cancelar Comanda" na interface
- Atualização do status da comanda para 'cancelada'
- Liberação da mesa (status 'disponivel')
- Tratamento de mesas juntas

---

### 3. Persistência de Rota (PARCIAL)

**Problema**: O código em `AdminLayout.tsx` já não redireciona ao atualizar, mas ainda exibe toast de erro.

**Estado Atual** (linha 58-65):
```typescript
if (match && !match.test) {
  if (path === '/admin') {
    navigate('/admin/assinatura');
  } else {
    toast.error('Recurso indisponível no seu plano'); // ← Ainda mostra erro!
  }
}
```

**Correção Necessária**: Remover ou condicionar o toast para não aparecer em page reloads.

---

### 4. Erro Cadastro Motoboy (RESOLVIDO ✅)

**Verificação**: Query SQL confirmou que `motoboy` já existe no enum:
```
proprietario, gerente, garcom, caixa, motoboy
```

Nenhuma ação necessária.

---

### 5. Erro Exclusão Membro (PENDENTE)

**Problema**: Ao excluir membro, email permanece bloqueado.

**Análise do código** (`Equipe.tsx` linhas 161-212):
- Chama Edge Function `/functions/v1/delete-user`
- Mas o URL está incorreto: usa `/functions/v1/` ao invés de URL completo

**Correção Necessária**: 
- Corrigir chamada da Edge Function
- Revisar se a função deleta corretamente do Auth

---

### 6. Couver/Música ao Vivo em PT-BR (PENDENTE)

**Problema**: Dias da semana estão em inglês (`MON`, `TUE`, `WED`...)

**Estado Atual** (`Empresa.tsx` linhas 264-274):
```typescript
{Object.entries(weekdays).map(([k, v]) => (
  <button>{k.slice(0,3).toUpperCase()}</button>  // MON, TUE, WED...
))}
```

**Correção Necessária**: Mapear para português:
```typescript
const diasSemana = [
  { key: 'monday', label: 'Seg' },
  { key: 'tuesday', label: 'Ter' },
  // ...
];
```

E formato de datas para DD/MM/YYYY.

---

### 7. Opção "Esqueci minha senha" (PENDENTE)

**Problema**: Não existe na página Auth.tsx, apenas em DeliveryProfile.

**Correção Necessária**: Adicionar link e modal para recuperação de senha usando `supabase.auth.resetPasswordForEmail()`.

---

### 8. Mensagem de Permissão para Staff (PENDENTE)

**Problema**: `AdminSidebar.tsx` mostra modal de upgrade para TODOS (linhas 204-213).

**Estado Atual**:
```typescript
<button onClick={() => { setUpgradeFeature(item.title); setUpgradeOpen(true); }}>
```

**Correção Necessária**: Verificar se é staff e mostrar apenas toast:
```typescript
if (isStaff) {
  toast.error('Seu perfil não tem permissão para acessar esta página');
} else {
  setUpgradeOpen(true);
}
```

---

### 9. Menu Lateral Filtrado por Perfil (PENDENTE)

**Problema**: Menu mostra todos os itens com cadeado ao invés de ocultar.

**Estado Atual** (`AdminSidebar.tsx` linha 145):
```typescript
const visibleMenuItems = allMenuItems;  // Mostra TODOS!
```

**Correção Necessária**: Filtrar itens para staff:
```typescript
const visibleMenuItems = useMemo(() => {
  if (isProprietario || isGerente || isSuperAdmin) {
    return allMenuItems;
  }
  return allMenuItems.filter(item => permissionMap[item.key]);
}, [role, permissionMap]);
```

---

### 10. Configurações para Todos os Perfis (PENDENTE)

**Problema**: `useUserRole.ts` restringe `canAccessConfiguracoes` apenas para admin.

**Estado Atual** (linha 329):
```typescript
canAccessConfiguracoes: hasFullAccess || (isAdmin && resolveFeature('configuracoes')),
```

**Correção Necessária**: 
- Permitir acesso a todos
- Criar flag `canAccessConfigSensitive` para seções restritas

---

### 11. Mostrar Perfil no Menu Lateral (PENDENTE)

**Problema**: Sidebar só mostra email, não mostra o perfil do usuário.

**Estado Atual** (`AdminSidebar.tsx` linhas 233-236):
```typescript
<p className="text-sm font-medium text-sidebar-foreground truncate">
  {user?.email}
</p>
// Falta mostrar o perfil!
```

**Correção Necessária**: Adicionar exibição do perfil:
```typescript
{role && (
  <p className="text-xs text-sidebar-foreground/70">
    Perfil: {getRoleLabel(role)}
  </p>
)}
```

---

### 12. Expandir Popup Novo Produto (PENDENTE)

**Problema**: Dialog usa `max-w-lg` com scroll.

**Estado Atual** (`Cardapio.tsx` linhas 319, 324):
```typescript
<DialogContent className="max-w-lg">
  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
```

**Correção Necessária**: Aumentar largura e remover scroll:
```typescript
<DialogContent className="max-w-xl">
  <div className="space-y-4">
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/utils/kitchenPrinter.ts` | Nova função `printCaixaReceipt()` |
| `src/pages/admin/Caixa.tsx` | Botão cancelar comanda + usar nova função de impressão |
| `src/components/admin/AdminLayout.tsx` | Remover toast em page reload |
| `src/pages/admin/Equipe.tsx` | Corrigir URL da Edge Function |
| `src/pages/admin/Empresa.tsx` | Dias da semana em português + formato de datas |
| `src/pages/Auth.tsx` | Adicionar "Esqueci minha senha" |
| `src/components/admin/AdminSidebar.tsx` | Filtrar menu + mostrar perfil + toast para staff |
| `src/hooks/useUserRole.ts` | `canAccessConfiguracoes` para todos |
| `src/pages/admin/Cardapio.tsx` | Expandir popup produto |

---

## Seção Técnica

### Fluxo de Impressão Cupom Não Fiscal (Correção #1)

```text
┌─────────────────────────────────────────────────────────────┐
│           RESTAURANTE XYZ - CNPJ 00.000.000/0000-00         │
│              Rua Exemplo, 123 - Centro                      │
├─────────────────────────────────────────────────────────────┤
│                        MESA 05                              │
│                     27/01/2026 21:30                        │
├─────────────────────────────────────────────────────────────┤
│ ITENS CONSUMIDOS                                            │
├─────────────────────────────────────────────────────────────┤
│ 2x X-Burguer Especial        R$ 25,00         R$ 50,00      │
│ 1x Batata Frita Grande       R$ 18,00         R$ 18,00      │
│ 3x Refrigerante 350ml        R$  6,00         R$ 18,00      │
├─────────────────────────────────────────────────────────────┤
│ SUBTOTAL                                      R$ 86,00      │
│ TAXA DE SERVIÇO (10%)                         R$  8,60      │
├─────────────────────────────────────────────────────────────┤
│ TOTAL                                         R$ 94,60      │
├─────────────────────────────────────────────────────────────┤
│ Forma de Pagamento: PIX                                     │
└─────────────────────────────────────────────────────────────┘
```

### Lógica de Permissões por Perfil (Correções #8, #9, #10)

```text
┌──────────────────┬─────────┬─────────┬────────┬───────┬─────────┐
│ Página/Recurso   │ Propr.  │ Gerente │ Garçom │ Caixa │ Motoboy │
├──────────────────┼─────────┼─────────┼────────┼───────┼─────────┤
│ Dashboard        │   ✓     │    ✓    │   ✗    │   ✓   │    ✗    │
│ Mesas            │   ✓     │    ✓    │   ✓    │   ✓   │    ✗    │
│ Cardápio         │   ✓     │    ✓    │   ✓*   │   ✓   │    ✗    │
│ Pedidos (KDS)    │   ✓     │    ✓    │   ✓    │   ✗   │    ✓    │
│ Delivery         │   ✓     │    ✓    │   ✗    │   ✓   │    ✓    │
│ Garçom           │   ✓     │    ✓    │   ✓    │   ✓   │    ✗    │
│ Caixa            │   ✓     │    ✓    │   ✗    │   ✓   │    ✓**  │
│ Equipe           │   ✓     │    ✓    │   ✗    │   ✗   │    ✗    │
│ Empresa          │   ✓     │    ✓    │   ✗    │   ✗   │    ✗    │
│ Configurações    │   ✓***  │   ✓***  │   ✓    │   ✓   │    ✓    │
│ Marketing        │   ✓     │    ✓    │   ✗    │   ✗   │    ✗    │
│ Assinatura       │   ✓     │    ✓    │   ✗    │   ✗   │    ✗    │
└──────────────────┴─────────┴─────────┴────────┴───────┴─────────┘

* Garçom: visualização apenas, sem criar categorias
** Motoboy: apenas finalização de pedidos delivery
*** Configurações completas (inclui Empresa, Couver, PIX)
```

### Comportamento do Menu Lateral por Perfil

**Proprietário/Gerente**: Menu completo com todas as opções
**Staff (Garçom, Caixa, Motoboy)**: Apenas opções permitidas visíveis (sem cadeados)

### Total de Correções

- **Resolvidas**: 1 (Motoboy enum)
- **Parcialmente Resolvidas**: 1 (Persistência de rota)
- **Pendentes**: 10 correções

