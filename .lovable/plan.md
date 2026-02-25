

# Correção: "Fechar Conta" e Sincronização Mobile/Desktop

## Problema 1: Permissão negada ao fechar conta

O botão "Fechar Conta" tenta atualizar o status da mesa (`mesas.status = 'solicitou_fechamento'`), mas o cliente acessa o cardápio sem autenticação (anônimo). A tabela `mesas` só permite UPDATE para staff autenticado da empresa. Resultado: erro RLS `42501` → "Permissão negada. Chame o garçom."

**Solução:** Criar uma policy RLS que permita UPDATE público na tabela `mesas`, restrito apenas à coluna de status e apenas para o valor `solicitou_fechamento`. Como RLS não controla colunas individuais, a abordagem segura é criar uma **função RPC** com `SECURITY DEFINER` que valida e executa apenas essa atualização específica, e chamá-la no frontend em vez do update direto.

## Problema 2: Pedidos não sincronizam entre dispositivos

O `comandaId` é salvo no `localStorage` do navegador. Quando o celular cria uma comanda e faz pedidos, o computador não tem esse ID no seu localStorage, então não carrega os pedidos. Cada dispositivo opera isoladamente.

**Solução:** Ao abrir o menu, além de verificar o localStorage, buscar no banco se já existe uma comanda aberta para aquela mesa. Se existir, usar essa comanda (e salvar no localStorage local). Isso garante que qualquer dispositivo acessando a mesma mesa veja os mesmos pedidos.

## Alterações

### 1. Database: Criar função RPC `solicitar_fechamento_mesa`

```sql
CREATE OR REPLACE FUNCTION public.solicitar_fechamento_mesa(p_mesa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE mesas
  SET status = 'solicitou_fechamento', updated_at = now()
  WHERE id = p_mesa_id
    AND status IN ('ocupada', 'disponivel');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa não encontrada ou já em processo de fechamento';
  END IF;
END;
$$;
```

### 2. Frontend `Menu.tsx` — `handleSolicitarFechamento`

Substituir o `supabase.from("mesas").update(...)` por `supabase.rpc("solicitar_fechamento_mesa", { p_mesa_id: mesaId })`.

### 3. Frontend `Menu.tsx` — Carregar comanda existente da mesa

No `useEffect` que valida a comanda (linhas 254-282), adicionar lógica: se não houver comanda no localStorage, buscar no banco uma comanda aberta para aquela `mesa_id` e `empresa_id`. Se encontrar, usar esse ID e salvar no localStorage.

```text
Fluxo atual:
  localStorage tem comandaId? → Sim → Validar no banco → Usar
                                → Não → Não faz nada (problema!)

Fluxo corrigido:
  localStorage tem comandaId? → Sim → Validar no banco → Usar
                                → Não → Buscar comanda aberta da mesa no banco
                                        → Encontrou? → Salvar no localStorage e usar
                                        → Não encontrou? → Aguardar primeiro pedido
```

## Detalhes Técnicos

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Criar função `solicitar_fechamento_mesa` |
| `src/pages/Menu.tsx` ~linha 505 | Trocar `.update()` por `.rpc()` |
| `src/pages/Menu.tsx` ~linha 256 | Adicionar fallback: buscar comanda aberta da mesa quando não há localStorage |

## Resultado

- Clientes conseguirão solicitar fechamento de conta sem erro de permissão
- Pedidos feitos no celular aparecerão no desktop (e vice-versa) para a mesma mesa
- A segurança é mantida: a função RPC só permite alterar para `solicitou_fechamento` em mesas válidas

