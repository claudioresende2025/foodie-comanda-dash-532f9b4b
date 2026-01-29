
# Plano de Correções Full-Stack - Food Comanda

## Resumo das 12 Correções Identificadas

| # | Problema | Prioridade |
|---|----------|------------|
| 1 | Impressão formato cupom não fiscal | Alta |
| 2 | Cancelar comanda → mesa disponível | Alta |
| 3 | Persistência de rota ao atualizar página | Alta |
| 4 | Erro cadastro Motoboy (enum faltando) | Alta |
| 5 | Erro exclusão membro (email já existe) | Média |
| 6 | Expandir Couver/Música ao vivo (pt-BR) | Média |
| 7 | Opção "Esqueci minha senha" | Média |
| 8 | Mensagem de permissão para staff | Média |
| 9 | Menu lateral filtrado por perfil | Alta |
| 10 | Configurações para todos os perfis | Média |
| 11 | Mostrar perfil no menu lateral | Média |
| 12 | Expandir popup novo produto | Baixa |

---

## Fase 1: Correções de Banco de Dados

### 1.1 Adicionar `motoboy` ao enum `app_role`

**Problema**: O enum `app_role` no banco de dados só possui: `proprietario`, `gerente`, `garcom`, `caixa`. O valor `motoboy` não existe, causando erro ao cadastrar funcionário com essa função.

**Solução**: Migração SQL para adicionar o valor ao enum:

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'motoboy';
```

---

## Fase 2: Correção de Impressão (Cupom Não Fiscal)

### 2.1 Refatorar função `handlePrint` em `Caixa.tsx`

**Problema**: A impressão atual usa o formato de pedidos de cozinha (KDS), não o formato de cupom fiscal com itens consumidos, valores e totais.

**Solução**: Criar nova função de impressão específica para caixa que inclua:
- Cabeçalho: dados do restaurante (logo, nome, endereço, CNPJ)
- Número da mesa
- Itens consumidos com quantidade, valor unitário e subtotal
- Taxa de serviço (quando ativada) ou omitir quando desativada
- Total final

**Alterações em `src/utils/kitchenPrinter.ts`**:
Criar nova função `printCaixaReceipt()` com formato de cupom fiscal:

```typescript
type CaixaReceiptData = {
  empresaNome: string;
  empresaEndereco: string;
  empresaCnpj?: string;
  mesaNumero: number;
  itens: { nome: string; quantidade: number; precoUnitario: number; subtotal: number }[];
  subtotal: number;
  desconto?: { percentual: number; valor: number };
  taxaServico?: { percentual: number; valor: number };
  couver?: { quantidade: number; valorUnitario: number; total: number };
  total: number;
  formaPagamento?: string;
  troco?: number;
  timestamp: Date;
};

export const printCaixaReceipt = (data: CaixaReceiptData) => {
  // Formato cupom não fiscal 80mm
  // ...
};
```

**Alterações em `src/pages/admin/Caixa.tsx`**:
Atualizar `handlePrint()` para usar a nova função:

```typescript
const handlePrint = () => {
  printCaixaReceipt({
    empresaNome: empresa?.nome_fantasia || 'Restaurante',
    empresaEndereco: empresa?.endereco_completo || '',
    empresaCnpj: empresa?.cnpj,
    mesaNumero: selectedComanda.mesa?.numero_mesa || 0,
    itens: selectedComanda.pedidos?.map((p: any) => ({
      nome: p.produto?.nome || 'Item',
      quantidade: p.quantidade,
      precoUnitario: p.preco_unitario,
      subtotal: p.subtotal,
    })) || [],
    subtotal: calcularSubtotal(selectedComanda),
    taxaServico: includeService ? { percentual: serviceCharge, valor: ... } : undefined,
    couver: includeCouver ? { ... } : undefined,
    total: calcularTotal(selectedComanda),
  });
};
```

---

## Fase 3: Cancelamento de Comanda com Liberação de Mesa

### 3.1 Adicionar função `handleCancelComanda` em `Caixa.tsx`

**Problema**: Não existe funcionalidade para cancelar uma comanda e liberar a mesa.

**Solução**: Criar mutation para cancelar comanda:

```typescript
const cancelComandaMutation = useMutation({
  mutationFn: async ({ comandaId, mesaId }: { comandaId: string; mesaId?: string }) => {
    // 1. Atualizar comanda para status 'cancelada'
    await supabase.from('comandas')
      .update({ status: 'cancelada', data_fechamento: new Date().toISOString() })
      .eq('id', comandaId);
    
    // 2. Liberar mesa (e mesas juntas, se houver)
    if (mesaId) {
      const { data: mesaData } = await supabase
        .from('mesas')
        .select('id, mesa_juncao_id')
        .eq('id', mesaId)
        .single();

      if (mesaData?.mesa_juncao_id) {
        // Mesa filha
        await supabase.from('mesas')
          .update({ status: 'disponivel', mesa_juncao_id: null })
          .eq('id', mesaId);
      } else {
        // Mesa principal: libera todas
        const { data: mesasJuncao } = await supabase
          .from('mesas')
          .select('id')
          .or(`id.eq.${mesaId},mesa_juncao_id.eq.${mesaId}`);

        if (mesasJuncao?.length) {
          await supabase.from('mesas')
            .update({ status: 'disponivel', mesa_juncao_id: null })
            .in('id', mesasJuncao.map(m => m.id));
        }
      }
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['comandas-abertas', profile?.empresa_id] });
    queryClient.invalidateQueries({ queryKey: ['mesas', profile?.empresa_id] });
    setSelectedComanda(null);
    toast.success('Comanda cancelada e mesa liberada!');
  },
});
```

Adicionar botão "Cancelar Comanda" na UI:

```tsx
<Button
  variant="destructive"
  onClick={() => cancelComandaMutation.mutate({
    comandaId: selectedComanda.id,
    mesaId: selectedComanda.mesa_id
  })}
>
  Cancelar Comanda
</Button>
```

---

## Fase 4: Persistência de Rota ao Atualizar Página

### 4.1 Corrigir lógica de redirecionamento em `AdminLayout.tsx`

**Problema**: O `useEffect` de verificação de permissão está redirecionando para `/admin/assinatura` mesmo quando o usuário está em uma página válida como `/admin/mesas`.

**Causa Raiz**: A condição `match && !match.test` com redirecionamento está sendo acionada prematuramente durante o carregamento.

**Solução**: Modificar a lógica para não redirecionar durante page reload:

```typescript
useEffect(() => {
  if (loading || roleLoading || !user) return;
  
  const path = location.pathname;
  
  // Não redirecionar em reload se a página já é válida para assinatura
  if (path.startsWith('/admin/assinatura')) return;
  
  const checks: { test: boolean; match: (p: string) => boolean }[] = [
    // ... lista de checks
  ];
  
  const matchedCheck = checks.find((c) => c.match(path));
  
  // Apenas redirecionar da raiz /admin se não tiver permissão
  if (matchedCheck && !matchedCheck.test) {
    if (path === '/admin') {
      navigate('/admin/assinatura');
    }
    // Para outras páginas, apenas notificar sem redirecionar
  }
}, [/* dependências */]);
```

---

## Fase 5: Correção de Exclusão de Membro da Equipe

### 5.1 Corrigir `deleteMemberMutation` em `Equipe.tsx`

**Problema**: Após excluir um membro, o email permanece bloqueado porque o perfil ainda existe com email = null mas o Auth User não é deletado corretamente, ou a Edge Function falha silenciosamente.

**Solução**: 
1. Verificar se a Edge Function `delete-user` está funcionando
2. Melhorar tratamento de erros na mutation
3. Garantir que o usuário seja removido do Auth

```typescript
const deleteMemberMutation = useMutation({
  mutationFn: async (userId: string) => {
    // ... código existente
    
    // Chamar Edge Function com melhor tratamento de erros
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao remover usuário do Auth');
    }
  },
  // ...
});
```

---

## Fase 6: Expandir Seção Couver/Música ao Vivo (pt-BR)

### 6.1 Atualizar `Empresa.tsx` com dias da semana em português

**Alterações**:

```typescript
const diasSemana = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

// No render:
<div className="grid grid-cols-7 gap-1">
  {diasSemana.map(({ key, label }) => (
    <button
      key={key}
      className={`px-2 py-1 rounded text-xs ${weekdays[key] ? 'bg-primary text-white' : 'bg-muted'}`}
      onClick={() => setWeekdays({ ...weekdays, [key]: !weekdays[key] })}
    >
      {label}
    </button>
  ))}
</div>

// Datas específicas no formato DD/MM/YYYY:
<Label>Datas específicas (DD/MM/YYYY, separadas por vírgula)</Label>
<Textarea
  placeholder="10/01/2025, 14/02/2025"
  value={specificDates}
  onChange={(e) => setSpecificDates(e.target.value)}
/>
```

---

## Fase 7: Adicionar "Esqueci minha senha" na Página Auth

### 7.1 Atualizar `Auth.tsx`

**Adicionar estado e função**:

```typescript
const [showForgotPassword, setShowForgotPassword] = useState(false);
const [forgotEmail, setForgotEmail] = useState('');

const handleForgotPassword = async () => {
  if (!forgotEmail) {
    toast.error('Digite seu e-mail');
    return;
  }
  
  setIsLoading(true);
  const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
    redirectTo: `${window.location.origin}/auth?mode=reset`,
  });
  setIsLoading(false);
  
  if (error) {
    toast.error('Erro ao enviar e-mail de recuperação');
  } else {
    toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    setShowForgotPassword(false);
  }
};
```

**Adicionar link na UI após campo de senha**:

```tsx
<button
  type="button"
  className="text-sm text-primary hover:underline"
  onClick={() => setShowForgotPassword(true)}
>
  Esqueci minha senha
</button>
```

---

## Fase 8: Mensagem de Permissão para Staff (sem modal de upgrade)

### 8.1 Atualizar `AdminSidebar.tsx`

**Problema**: Quando staff (Garçom, Caixa, Motoboy) clica em item bloqueado, aparece modal de upgrade com preços de planos.

**Solução**: Verificar se é staff (não Proprietário/Gerente) e mostrar toast simples:

```typescript
// No AdminSidebar.tsx
const isStaffOnly = role && !['proprietario', 'gerente'].includes(role);

// No render do menu:
{allowed ? (
  <NavLink to={item.url} ...>
    ...
  </NavLink>
) : isStaffOnly ? (
  <button
    onClick={() => toast.error('Seu perfil não tem permissão para acessar esta página')}
    className="flex items-center gap-3 text-sidebar-foreground opacity-50 cursor-not-allowed"
  >
    <item.icon className="w-5 h-5" />
    <span>{item.title}</span>
  </button>
) : (
  <button
    onClick={() => { setUpgradeFeature(item.title); setUpgradeOpen(true); }}
    ...
  >
    ...
  </button>
)}
```

---

## Fase 9: Filtrar Menu Lateral por Perfil

### 9.1 Ocultar itens sem permissão (para staff)

**Alterar lógica de visibilidade**:

```typescript
// Ao invés de mostrar todos os itens e desabilitar alguns:
const visibleMenuItems = useMemo(() => {
  // Proprietário e Gerente veem tudo
  if (isProprietario || isGerente || isSuperAdmin) {
    return allMenuItems;
  }
  
  // Staff vê apenas itens permitidos
  return allMenuItems.filter(item => permissionMap[item.key]);
}, [isProprietario, isGerente, isSuperAdmin, permissionMap]);
```

---

## Fase 10: Configurações Acessível para Todos os Perfis

### 10.1 Atualizar `useUserRole.ts`

**Alterar permissão de `canAccessConfiguracoes`**:

```typescript
// Antes:
canAccessConfiguracoes: hasFullAccess || (isAdmin && resolveFeature('configuracoes')),

// Depois - todos têm acesso (com seções limitadas):
canAccessConfiguracoes: true, // Todos os perfis têm acesso

// Nova flag para controlar seções sensíveis:
canAccessConfigSensitive: isAdmin, // Dados da Empresa, Couver, PIX
```

### 10.2 Atualizar página `Configuracoes.tsx`

**Renderizar seções condicionalmente**:

```tsx
const { canAccessConfigSensitive } = useUserRole();

// Seções disponíveis para todos:
// - Notificações
// - Aparência
// - Segurança (senha, 2FA)

// Seções apenas para admin (Proprietário/Gerente):
{canAccessConfigSensitive && (
  <>
    <DadosEmpresaSection />
    <CouverSection />
    <PixSection />
  </>
)}
```

---

## Fase 11: Mostrar Perfil do Membro no Menu Lateral

### 11.1 Atualizar `AdminSidebar.tsx`

**Adicionar exibição do perfil no footer**:

```typescript
// Obter role do useUserRole
const { role } = useUserRole();

const getRoleLabel = (r: string | null) => {
  const labels: Record<string, string> = {
    proprietario: 'Proprietário',
    gerente: 'Gerente',
    garcom: 'Garçom',
    caixa: 'Caixa',
    motoboy: 'Motoboy',
  };
  return r ? labels[r] || r : '';
};

// No SidebarFooter:
<SidebarFooter className="p-4">
  <div className="flex flex-col gap-2 p-3 rounded-lg bg-sidebar-accent/50">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
        <span className="text-sm font-medium">
          {user?.email?.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user?.email}</p>
        {role && (
          <p className="text-xs text-sidebar-foreground/70">
            Perfil: {getRoleLabel(role)}
          </p>
        )}
      </div>
      {/* ... botões */}
    </div>
  </div>
</SidebarFooter>
```

---

## Fase 12: Expandir Popup de Novo Produto

### 12.1 Atualizar `Cardapio.tsx`

**Alterar DialogContent**:

```tsx
// Antes:
<DialogContent className="max-w-lg">
  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">

// Depois:
<DialogContent className="max-w-xl">
  <div className="space-y-4">
```

Remover a altura máxima e scroll para que o conteúdo caiba naturalmente.

---

## Resumo de Arquivos a Modificar

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `supabase/migrations/*` | Nova migração para enum motoboy |
| `src/utils/kitchenPrinter.ts` | Nova função `printCaixaReceipt` |
| `src/pages/admin/Caixa.tsx` | Cancelar comanda + Nova impressão |
| `src/components/admin/AdminLayout.tsx` | Corrigir lógica de redirect |
| `src/pages/admin/Equipe.tsx` | Corrigir exclusão de membro |
| `src/pages/admin/Empresa.tsx` | Dias da semana pt-BR |
| `src/pages/Auth.tsx` | Esqueci minha senha |
| `src/components/admin/AdminSidebar.tsx` | Menu filtrado + Perfil visível |
| `src/hooks/useUserRole.ts` | Permissão Configurações para todos |
| `src/pages/admin/Cardapio.tsx` | Expandir popup produto |

---

## Seção Técnica

### Fluxo de Impressão Cupom Não Fiscal

```text
┌─────────────────────────────────────────────────────────────┐
│               CUPOM NÃO FISCAL - CAIXA                      │
├─────────────────────────────────────────────────────────────┤
│                    RESTAURANTE XYZ                          │
│              Rua Exemplo, 123 - Centro                      │
│              CNPJ: 00.000.000/0000-00                       │
├─────────────────────────────────────────────────────────────┤
│                      MESA 05                                │
│                   27/01/2026 21:30                          │
├─────────────────────────────────────────────────────────────┤
│ ITENS CONSUMIDOS:                                           │
├─────────────────────────────────────────────────────────────┤
│ 2x X-Burguer Especial          R$ 25,00    R$ 50,00         │
│ 1x Batata Frita Grande         R$ 18,00    R$ 18,00         │
│ 3x Refrigerante 350ml          R$  6,00    R$ 18,00         │
├─────────────────────────────────────────────────────────────┤
│ SUBTOTAL:                                  R$ 86,00         │
│ TAXA DE SERVIÇO (10%):                     R$  8,60         │
├─────────────────────────────────────────────────────────────┤
│ TOTAL:                                     R$ 94,60         │
├─────────────────────────────────────────────────────────────┤
│ Forma de Pagamento: PIX                                     │
└─────────────────────────────────────────────────────────────┘
```

### Lógica de Permissões por Perfil

```text
┌──────────────────┬─────────┬─────────┬────────┬───────┬─────────┐
│ Página           │ Propr.  │ Gerente │ Garçom │ Caixa │ Motoboy │
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
*** Configurações completas (Proprietário/Gerente incluem Empresa, Couver, PIX)
```

