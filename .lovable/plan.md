

# Correção: Leitura de Cardápio com IA em vez de OCR

## Problema

O Tesseract.js (OCR local no navegador) tem baixa precisão com cardápios reais que possuem:
- Múltiplas colunas e seções
- Fontes decorativas e variadas
- Imagens misturadas com texto
- Preços em formatos variados (ex: "27.99 • 30.99")

O parser de texto (`menuTextParser.ts`) também não lida bem com esses layouts complexos.

## Solução

Substituir o Tesseract.js por **Lovable AI com modelo de visão** (Gemini), que entende layouts visuais complexos e extrai dados estruturados com alta precisão.

### 1. Criar Edge Function `scan-menu`
**Arquivo:** `supabase/functions/scan-menu/index.ts`

- Recebe a imagem em base64
- Envia para o Lovable AI Gateway usando modelo `google/gemini-2.5-flash` com a imagem
- Usa tool calling para extrair dados estruturados: `{ produtos: [{ nome, descricao, preco }] }`
- Prompt instrui o modelo a identificar todos os itens com nomes e preços exatos do cardápio

### 2. Atualizar `MenuScannerModal.tsx`
- Remover import dinâmico de `tesseract.js`
- Remover função `preprocessarImagem` (não mais necessária)
- Na função `processarImagem`, chamar a edge function `scan-menu` via `supabase.functions.invoke`
- Manter todo o fluxo de UI (seleção, câmera, revisão, imagens de produto)

### 3. Manter `menuTextParser.ts` como fallback
- Não remover, mas o fluxo principal usará a IA
- Se a edge function falhar, pode cair no parser local

## Resultado esperado

- Leitura precisa de nomes, descrições e preços exatamente como aparecem no cardápio
- Suporte a layouts complexos com múltiplas colunas e seções
- Preços com variações (ex: "27.99 • 30.99") corretamente identificados

**Total: 2 arquivos (1 novo edge function + 1 atualização do modal)**

