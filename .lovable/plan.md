
# Correcao: Enum delivery_status nao aceita "pago"

## Problema

A edge function `complete-delivery-order` tenta inserir um pedido com `status: "pago"`, mas o enum `delivery_status` no banco so aceita: `pendente`, `confirmado`, `em_preparo`, `saiu_entrega`, `entregue`, `cancelado`.

## Solucao

Adicionar o valor `"pago"` ao enum `delivery_status` no banco de dados. Esse status faz sentido porque indica que o pagamento via cartao foi confirmado pelo Stripe, mas o pedido ainda nao foi confirmado pelo restaurante.

### Alteracoes

| Arquivo/Recurso | O que muda |
|-----------------|-----------|
| Migration SQL (banco de dados) | `ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'pago';` |

Nenhuma alteracao de codigo e necessaria -- a edge function ja usa `"pago"` corretamente, so faltava o valor no enum do banco.

### Detalhes Tecnicos

A migration executa:
```sql
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'pago';
```

Isso adiciona `pago` como valor valido entre `pendente` e `confirmado`, representando o fluxo: **pendente -> pago -> confirmado -> em_preparo -> saiu_entrega -> entregue**.

### Resultado Esperado

1. Cliente faz pedido e paga via cartao
2. Stripe confirma pagamento
3. Edge function insere pedido com `status: 'pago'` -- agora aceito pelo banco
4. Tela de sucesso aparece normalmente
5. Restaurante ve o pedido com status "Pago" no painel
