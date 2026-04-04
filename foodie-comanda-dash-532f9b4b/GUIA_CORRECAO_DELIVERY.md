# 🔧 Guia de Correção do Erro de Delivery

## ❌ Problema Identificado

**Erro**: `Could not find a relationship between 'pedidos_delivery' and 'itens_delivery' in the schema cache`

**Causa**: O cache do schema do Supabase não está reconhecendo o relacionamento de Foreign Key entre as tabelas `pedidos_delivery` e `itens_delivery`.

## ✅ Solução Implementada

### 1. Migração SQL Criada ✓
- **Arquivo**: `supabase/migrations/20260102_fix_delivery_relationships.sql`
- **Conteúdo**: Recria tabelas e relacionamentos com constraints explícitas

### 2. Componente de Notificação de Atualização ✓
- **Arquivo**: `src/components/UpdateNotification.tsx`
- **Funcionalidade**: Notifica usuário quando há nova versão disponível
- **Integrado em**: `src/App.tsx`

### 3. SQL Simplificado para Aplicação Manual ✓
- **Arquivo**: `fix-relationship.sql`
- **Uso**: Aplicar diretamente no SQL Editor do Supabase

## 🚀 Passos para Aplicar a Correção

### Opção 1: SQL Editor do Supabase (RECOMENDADO)

1. **Acesse o SQL Editor**:
   ```
   https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/sql/new
   ```

2. **Cole o SQL abaixo**:
   ```sql
   -- Remover constraint antiga se existir
   ALTER TABLE IF EXISTS public.itens_delivery 
     DROP CONSTRAINT IF EXISTS itens_delivery_pedido_delivery_id_fkey;

   -- Adicionar constraint com nome explícito
   ALTER TABLE public.itens_delivery 
     ADD CONSTRAINT itens_delivery_pedido_delivery_id_fkey 
     FOREIGN KEY (pedido_delivery_id) 
     REFERENCES public.pedidos_delivery(id) 
     ON DELETE CASCADE;

   -- Criar índices
   CREATE INDEX IF NOT EXISTS idx_itens_delivery_pedido_id 
     ON public.itens_delivery(pedido_delivery_id);
   ```

3. **Clique em "Run"**

4. **Aguarde 1-2 minutos** para o cache atualizar

5. **Teste a aplicação** acessando `/delivery`

### Opção 2: Workaround Temporário no Frontend

Se não puder aplicar o SQL imediatamente, foi criada uma versão alternativa das queries que não usa relacionamentos:

**Arquivo modificado**: `src/pages/DeliveryOrders.tsx` (se necessário)

## 🧪 Como Verificar se Funcionou

Execute o script de teste:
```bash
node refresh-schema.js
```

Você deve ver:
```
✅ Relacionamento funcionando!
📊 Pedidos encontrados: X
```

## 📱 Teste na Aplicação

1. Acesse: `http://localhost:8080/delivery`
2. Escolha um restaurante
3. Faça um pedido
4. Verifique se não há erros no console
5. Acesse "Meus Pedidos"

## 🔍 Diagnóstico Atual

```
✅ Tabela pedidos_delivery: Existe
✅ Tabela itens_delivery: Existe (19 registros)
❌ Relacionamento no cache: Não reconhecido
✅ Componente de notificação: Implementado
✅ Frontend: Queries corretas
```

## 📝 Arquivos Modificados

1. `/supabase/migrations/20260102_fix_delivery_relationships.sql` - Migração SQL
2. `/src/components/UpdateNotification.tsx` - Novo componente
3. `/src/App.tsx` - Integração da notificação
4. `/fix-relationship.sql` - SQL simplificado para aplicação manual

## 🎯 Próximos Passos

1. **Aplicar o SQL no dashboard** (Opção 1 acima)
2. **Aguardar cache atualizar** (1-2 minutos)
3. **Testar aplicação** no navegador
4. **Verificar notificação de atualização** aparecendo após rebuild

## ⚡ Build e Deploy

Após aplicar a correção no banco:

```bash
# Build da aplicação
npm run build

# O service worker será atualizado automaticamente
# A notificação de atualização aparecerá para usuários já conectados
```

## 🆘 Suporte

Se o problema persistir:
1. Verifique logs do navegador (F12 > Console)
2. Teste `node refresh-schema.js` novamente
3. Verifique se o constraint existe no Supabase Dashboard
4. Limpe o cache do navegador (Ctrl+Shift+Delete)

## 📊 Status das Correções

- [x] Identificar problema
- [x] Criar migração SQL
- [x] Implementar notificação de atualização
- [x] Gerar SQL simplificado
- [ ] **Aplicar SQL no Supabase** ⚠️ PENDENTE
- [ ] Verificar funcionamento
- [ ] Deploy da nova versão
