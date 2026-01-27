
# Plano de Correção Definitiva: Cancelamento, Reembolso e Troca de Plano

## Diagnóstico Confirmado

### ✅ Estrutura Atual da Tabela `assinaturas`
```
| Coluna                 | Tipo      | Existe? |
|------------------------|-----------|---------|
| cancel_at_period_end   | BOOLEAN   | ❌ NÃO  |
| canceled_at            | TIMESTAMP | ✅ SIM  |
| stripe_subscription_id | TEXT      | ✅ SIM  |
```

### Problema 1: Cancelamento Falha Silenciosamente
**Causa**: O código em `Assinatura.tsx` (linha 216) tenta atualizar `cancel_at_period_end`, mas esse campo **não existe** na tabela.

```typescript
// Linha 216 - CAMPO NÃO EXISTE!
.update({ cancel_at_period_end: true, ... })
```

**Resultado**: O update não afeta nenhuma linha e a assinatura não é cancelada.

### Problema 2: Reembolso Mostra "Nenhum pagamento encontrado"
**Causa**: A função `request-refund` (linha 224) busca APENAS pagamentos com status `succeeded`:

```typescript
.eq("status", "succeeded")
```

Durante o período de trial, os pagamentos registrados têm status `trial` com valor `0`, portanto não há nada para reembolsar.

### Problema 3: Troca de Plano
**Causa Potencial**: O fluxo está implementado, mas a verificação visual indica que pode haver falha na atualização do `plano_id` após o checkout.

---

## Solução Completa

### Fase 1: Migração SQL (Executar no Supabase Externo)

**⚠️ AÇÃO MANUAL NECESSÁRIA**: Execute este SQL no SQL Editor do projeto externo (`zlwpxflqtyhdwanmupgy`):

```sql
-- Adicionar coluna cancel_at_period_end
ALTER TABLE assinaturas 
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Criar índice para consultas futuras
CREATE INDEX IF NOT EXISTS idx_assinaturas_cancel_period 
ON assinaturas (cancel_at_period_end) 
WHERE cancel_at_period_end = TRUE;
```

---

### Fase 2: Criar Edge Function `cancel-subscription`

Nova edge function para cancelar assinaturas via API do Stripe:

**Arquivo**: `supabase/functions/cancel-subscription/index.ts`

**Funcionalidades**:
- Recebe `subscriptionId` e `cancelAtPeriodEnd` (boolean)
- Chama a API do Stripe para agendar/cancelar imediatamente
- Atualiza o banco de dados local
- Suporte para cancelamento imediato durante trial (sem cobrança)

**Código**:
```typescript
serve(async (req) => {
  const { subscriptionId, cancelAtPeriodEnd, cancelImmediately } = await req.json();
  
  // Chamar Stripe API
  if (cancelImmediately) {
    await stripeRequest(`subscriptions/${subscriptionId}`, 'DELETE');
  } else {
    await stripeRequest(`subscriptions/${subscriptionId}`, 'POST', {
      cancel_at_period_end: true
    });
  }
  
  return new Response(JSON.stringify({ success: true }));
});
```

---

### Fase 3: Corrigir `request-refund` para Trial

**Arquivo**: `supabase/functions/request-refund/index.ts`

**Alterações**:
1. Detectar status de trial e retornar mensagem apropriada
2. Melhorar feedback para o usuário
3. Não bloquear com erro quando não há pagamentos

**Trecho modificado** (linha ~202):
```typescript
// NOVO: Verificar se está em trial
if (assinatura.status === 'trialing' || assinatura.status === 'trial') {
  return new Response(JSON.stringify({ 
    success: false,
    error: "Período de teste gratuito", 
    message: "Durante o período de teste não há cobranças. Para cancelar, use 'Cancelar Assinatura'.",
    isTrialing: true
  }), { status: 200, headers: corsHeaders });
}
```

---

### Fase 4: Atualizar Frontend `Assinatura.tsx`

**Arquivo**: `src/pages/admin/Assinatura.tsx`

**Alterações**:

#### 4.1. Adicionar `cancel_at_period_end` na interface
```typescript
interface Assinatura {
  // ... campos existentes
  cancel_at_period_end?: boolean; // NOVO
}
```

#### 4.2. Corrigir `handleCancelSubscription`
```typescript
const handleCancelSubscription = async () => {
  setIsCanceling(true);
  try {
    // Durante trial: cancelar imediatamente (sem cobrança)
    const isTrialing = assinatura?.status === 'trialing' || assinatura?.status === 'trial';
    
    // Se tem stripe_subscription_id, cancelar via Stripe
    if (assinatura?.stripe_subscription_id) {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: {
          subscriptionId: assinatura.stripe_subscription_id,
          cancelAtPeriodEnd: !isTrialing, // Trial = cancelar imediato
          cancelImmediately: isTrialing,
        },
      });
      if (error) throw error;
    }
    
    // Atualizar no banco local
    const updatePayload = isTrialing
      ? { status: 'canceled', canceled_at: new Date().toISOString() }
      : { cancel_at_period_end: true };
    
    await supabase
      .from('assinaturas')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('empresa_id', profile?.empresa_id);

    toast.success(isTrialing 
      ? 'Assinatura cancelada com sucesso' 
      : 'Assinatura será cancelada ao fim do período atual'
    );
    setCancelDialogOpen(false);
    await fetchData();
  } catch (err) {
    console.error('Erro ao cancelar:', err);
    toast.error('Erro ao cancelar assinatura');
  } finally {
    setIsCanceling(false);
  }
};
```

#### 4.3. Corrigir lógica de detecção de cancelamento agendado
```typescript
// Linha 354 - ANTES (errado):
const isCanceledAtPeriodEnd = !!assinatura?.canceled_at && assinatura?.status !== 'canceled';

// DEPOIS (correto):
const isCanceledAtPeriodEnd = assinatura?.cancel_at_period_end === true 
  && assinatura?.status !== 'canceled';
```

#### 4.4. Esconder botão "Solicitar Reembolso" durante trial
```typescript
// Linha 550-555 - Condição atualizada
{assinatura.status === 'active' && pagamentos.some(p => p.status === 'succeeded' && p.valor > 0) && (
  <Button variant="outline" onClick={() => setRefundDialogOpen(true)}>
    <Receipt className="w-4 h-4 mr-2" />
    Solicitar Reembolso
  </Button>
)}
```

---

### Fase 5: Atualizar `supabase/config.toml`

Adicionar nova edge function:
```toml
[functions.cancel-subscription]
verify_jwt = false
```

---

## Resumo de Alterações

| # | Arquivo/Ação | Tipo | Descrição |
|---|--------------|------|-----------|
| 1 | **SQL Migration** | Manual | Adicionar coluna `cancel_at_period_end` |
| 2 | `cancel-subscription/index.ts` | Criar | Nova edge function para cancelar no Stripe |
| 3 | `request-refund/index.ts` | Modificar | Detectar trial e retornar mensagem clara |
| 4 | `Assinatura.tsx` | Modificar | Corrigir lógica de cancelamento e esconder reembolso no trial |
| 5 | `config.toml` | Modificar | Registrar nova edge function |

---

## Deploy no Projeto Externo

**⚠️ AÇÃO MANUAL NECESSÁRIA após as alterações**: Execute no terminal:

```bash
# Deploy das edge functions corrigidas
supabase functions deploy cancel-subscription request-refund --no-verify-jwt --project-ref zlwpxflqtyhdwanmupgy
```

---

## Fluxo Corrigido

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANCELAR ASSINATURA                          │
└─────────────────────────────────────────────────────────────────┘
           │
           ├── Se status = 'trialing'
           │       └── Cancelar IMEDIATAMENTE (via Stripe API DELETE)
           │              └── Atualizar status = 'canceled'
           │              └── Mensagem: "Assinatura cancelada com sucesso"
           │
           └── Se status = 'active'
                   └── Agendar cancelamento no fim do período
                          ├── Chamar Stripe API (cancel_at_period_end: true)
                          └── Atualizar cancel_at_period_end = true
                          └── Mensagem: "Será cancelada ao fim do período"

┌─────────────────────────────────────────────────────────────────┐
│                    SOLICITAR REEMBOLSO                          │
└─────────────────────────────────────────────────────────────────┘
           │
           ├── Se status = 'trialing'
           │       └── BOTÃO NÃO APARECE NA UI
           │       └── Se chamado: Retorna "Sem cobranças durante trial"
           │
           └── Se status = 'active' E tem pagamentos succeeded > R$ 0
                   └── Exibir botão "Solicitar Reembolso"
                   └── Processar via Stripe Refund API
```

---

## Instruções de Execução

1. **Primeiro**: Execute o SQL no projeto externo (adicionar coluna)
2. **Segundo**: Aprovar este plano para eu implementar as alterações nos arquivos
3. **Terceiro**: Após a implementação, faça o deploy das edge functions via CLI

Posso prosseguir com a implementação após sua aprovação?
