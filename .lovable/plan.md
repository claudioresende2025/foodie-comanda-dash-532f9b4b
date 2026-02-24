

# Correcao: Mapa com localizacao real do cliente e motoboy

## Problemas Encontrados

### 1. Tabelas diferentes para escrita e leitura
O motoboy envia sua localizacao para a tabela `delivery_tracking`, mas o cliente le da tabela `delivery_locations`. Resultado: o mapa nunca recebe a posicao do motoboy.

### 2. Endereco do cliente nao tem coordenadas
A tabela `enderecos_cliente` nao possui colunas `latitude` e `longitude`. Por isso, o mapa nao sabe onde o cliente esta e mostra Sao Paulo como padrao.

### 3. GPS do cliente nunca e solicitado
A pagina de tracking do cliente nao pede permissao de GPS. O mapa depende de coordenadas que nao existem.

---

## Solucao

### Passo 1: Banco de Dados

- Adicionar colunas `latitude` e `longitude` na tabela `enderecos_cliente` para armazenar as coordenadas do cliente.
- Unificar: fazer o motoboy gravar na tabela `delivery_locations` (que ja existe e ja tem realtime configurado), em vez de `delivery_tracking`.

```sql
ALTER TABLE enderecos_cliente 
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;
```

### Passo 2: Entregador grava na tabela correta

Alterar `EntregadorPanel.tsx` para que a funcao `sendLocationToServer` use a tabela `delivery_locations` em vez de `delivery_tracking`. Isso garante que o hook `useDeliveryTracking` do cliente receba os dados.

Antes:
```typescript
.from('delivery_tracking')
```

Depois:
```typescript
.from('delivery_locations')
```

O mesmo para `stopGPSTracking` que atualiza o status final.

### Passo 3: Solicitar GPS do cliente na pagina de tracking

Alterar `DeliveryTracking.tsx` para:
1. Ao carregar, pedir permissao de GPS ao cliente
2. Se permitido, salvar as coordenadas no `enderecos_cliente` do pedido
3. Passar a localizacao real do cliente para o componente `DeliveryMap`

Novo fluxo:
```text
Cliente abre pagina de tracking
  |
  +-- Navegador pede permissao de GPS
  |     |
  |     +-- Permitiu -> Salva lat/lng no enderecos_cliente
  |     |               Passa para DeliveryMap como customerLocation
  |     |
  |     +-- Negou -> Mostra aviso pedindo para ativar GPS
  |                  Mapa mostra apenas motoboy (se disponivel)
```

### Passo 4: Mostrar aviso de GPS desativado

Se o cliente negar a permissao de GPS ou o GPS estiver desligado, exibir um aviso claro na tela de tracking explicando que precisa ativar o GPS para ver sua localizacao no mapa.

---

## Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| Migration SQL | Adicionar colunas `latitude`/`longitude` em `enderecos_cliente` |
| `src/pages/admin/EntregadorPanel.tsx` | Mudar `delivery_tracking` para `delivery_locations` |
| `src/pages/DeliveryTracking.tsx` | Adicionar solicitacao de GPS do cliente, salvar coordenadas, passar para mapa |
| `src/components/delivery/DeliveryMap.tsx` | Ajustar overlay para exibir aviso quando GPS esta desativado |

## Resultado Esperado

1. Cliente abre pagina de acompanhamento e o navegador pede permissao de GPS
2. Se permitir, o mapa centraliza na localizacao real do cliente (marcador verde)
3. Motoboy clica "Saiu para Entrega" e seu GPS e ativado
4. Localizacao do motoboy e gravada na tabela `delivery_locations`
5. Cliente ve o motoboy se movendo em tempo real no mapa (marcador roxo animado)
6. Se GPS estiver desligado, aparece aviso pedindo para ativar

