

# Plano: 4 Funcionalidades (Auto-Print + Config Impressoras + Venda Avulsa + Fix Scanner)

## 1. Impressão automática na cozinha (KDS)

**Arquivo:** `src/pages/admin/Pedidos.tsx`

No bloco de realtime (linha ~386), quando `payload.eventType === "INSERT"`:
- Ler configuração `autoPrint` do `localStorage` (key `config_settings`)
- Se ativo, buscar dados completos do pedido novo (produto nome, quantidade, notas, mesa) via query
- Importar e chamar `printKitchenOrder()` de `@/utils/kitchenPrinter`
- O navegador abrirá o diálogo de impressão; para contornar, o operador configura a impressora como padrão no dispositivo

---

## 2. Configuração de impressoras (Configurações)

**Arquivo:** `src/pages/admin/Configuracoes.tsx`

Expandir a seção "Impressão" existente com dois sub-blocos:

- **Impressora Cozinha (KDS):** Select de tipo de conexão (Wi-Fi / Bluetooth / USB / Padrão do sistema), campo nome/IP, toggle autoPrint (já existe), botão testar
- **Impressora Caixa:** Select de tipo de conexão, campo nome/IP, toggle printLogo (já existe), botão testar

Adicionar ao tipo `ConfigSettings`:
- `printerKdsType`, `printerKdsName`, `printerCaixaType`, `printerCaixaName`

Incluir texto explicativo de como configurar a impressora no dispositivo (definir como impressora padrão no Android/tablet para impressão sem diálogo).

---

## 3. Venda avulsa no Caixa

**Arquivo:** `src/pages/admin/Caixa.tsx`

Adicionar botão "Venda Avulsa" no topo da página. Ao clicar, abre um Dialog com:
- Busca de produtos do cardápio (query na tabela `produtos`)
- Campo para adicionar item manual (nome + preço) para itens que não estão no cardápio
- Lista de itens adicionados com quantidade editável
- Seleção de forma de pagamento
- Botão "Finalizar Venda"

Ao finalizar:
- Inserir registro na tabela `vendas_concluidas` com `comanda_id: null`, `mesa_id: null`
- Se houver caixa aberto, registrar em `movimentacoes_caixa`
- Imprimir cupom via `printCaixaReceipt`

---

## 4. Correção do Scanner de Cardápio

### 4a. Erro ao carregar imagem
**Arquivo:** `src/components/admin/MenuScannerModal.tsx`

Verificar e corrigir o fluxo de `handleFileUpload` — a imagem em base64 pode estar sendo enviada com o prefixo `data:image/...;base64,` duplicado ou o tamanho pode estar excedendo limites. Adicionar tratamento de erro mais robusto e feedback ao usuário.

### 4b. Nomes e preços incorretos na extração
**Arquivo:** `supabase/functions/scan-menu/index.ts`

Melhorar o prompt do sistema para o modelo Gemini:
- Reforçar que os nomes devem ser extraídos **exatamente** como escritos no cardápio
- Reforçar que cada produto deve ter seu **próprio preço** — nunca repetir o preço de outro item
- Adicionar instrução para respeitar a estrutura visual (colunas, seções)
- Trocar o modelo para `google/gemini-2.5-pro` (melhor em visão complexa) em vez de `flash`
- Aumentar `max_tokens` para cardápios grandes

---

## Resumo de arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/pages/admin/Pedidos.tsx` | Auto-print no INSERT realtime |
| `src/pages/admin/Configuracoes.tsx` | Seção expandida de impressoras KDS + Caixa |
| `src/pages/admin/Caixa.tsx` | Modal de venda avulsa |
| `src/components/admin/MenuScannerModal.tsx` | Fix erro upload de imagem |
| `supabase/functions/scan-menu/index.ts` | Prompt melhorado + modelo pro |

**Total: 5 arquivos**

