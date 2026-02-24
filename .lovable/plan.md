
# Correcao: Erro Foreign Key ao Criar Pedido Delivery

## Problema

Ao finalizar um pagamento via cartao ou PIX no delivery, aparece o erro:
```
insert or update on table "pedidos_delivery" violates foreign key constraint "pedidos_delivery_empresa_id_fkey"
Key (empresa_id)=(3e3d5937-...) is not present in table "empresas"
```

## Causa Raiz

O sistema usa **duas bases de dados diferentes** que estao dessincronizadas:

```text
Frontend (app)          -->  Lovable Cloud DB (jejpufnzaineihemdrgd)
                              - Contem empresas (ex: Sabor e Arte)
                              - Cliente navega e monta o pedido aqui

Edge Functions          -->  DB Externo (zlwpxflqtyhdwanmupgy)
(complete-delivery-order)     - NAO contem as mesmas empresas
                              - Tenta inserir pedido com empresa_id que nao existe aqui
                              - ERRO: foreign key violation
```

O frontend le as empresas do Lovable Cloud DB, mas as edge functions `complete-delivery-order` e `create-delivery-checkout` inserem pedidos no DB externo via `EXTERNAL_SUPABASE_URL`. Como a empresa nao existe no DB externo, a foreign key falha.

## Solucao

Remover a logica de banco externo das edge functions. Como o frontend ja usa o Lovable Cloud DB, as edge functions devem usar o **mesmo banco** (variaveis padrao `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`).

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/complete-delivery-order/index.ts` | Remover logica de EXTERNAL_SUPABASE_URL/KEY. Usar apenas SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY |
| `supabase/functions/create-delivery-checkout/index.ts` | Mesma alteracao - remover fallback externo |
| `supabase/functions/verify-delivery-payment/index.ts` | Verificar e aplicar mesma correcao se necessario |

### Detalhes Tecnicos

Nas 3 edge functions, substituir:

```text
ANTES:
  const externalSupabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const externalSupabaseServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = externalSupabaseUrl || Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = externalSupabaseServiceKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

DEPOIS:
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
```

Tambem remover os logs que mencionam "EXTERNAL DB" e "usingExternalDb".

## Resultado Esperado

1. Cliente faz pedido no delivery
2. Paga via cartao ou PIX
3. Edge function insere o pedido no **mesmo banco** que o frontend usa
4. Empresa existe, foreign key valida, pedido criado com sucesso
5. Tela de sucesso aparece normalmente
