

# Plano: Corrigir erro do Scanner de Imagem + Redimensionar Header do Caixa

## Diagnóstico

### Erro do Scanner
O app usa um **cliente Supabase customizado** (`src/config/supabase.ts`) apontando para o projeto externo `zlwpxflqtyhdwanmupgy`. Porém, a edge function `scan-menu` está deployada no **Lovable Cloud** (`jejpufnzaineihemdrgd`). Quando `supabase.functions.invoke('scan-menu')` é chamado, a requisição vai para o projeto errado, onde a função não existe -- resultando no erro "Não foi possível processar a imagem".

### Header do Caixa
Os botões "Venda Avulsa" e "Atualizar" ficam na mesma linha do título em mobile, causando layout apertado. Precisam ficar empilhados abaixo.

## Alterações

### 1. `src/components/admin/MenuScannerModal.tsx`
- Na função `processarImagem`, trocar a chamada `supabase.functions.invoke('scan-menu', ...)` por uma chamada `fetch` direta ao endpoint correto do Lovable Cloud:
  `https://jejpufnzaineihemdrgd.supabase.co/functions/v1/scan-menu`
- Passar os headers necessários (`Authorization` com anon key do Lovable Cloud, `Content-Type`)
- Melhorar mensagens de erro para diferenciar falha de conexão vs falha de processamento
- Adicionar também limitação de altura na compressão (max 1920x1920) e qualidade 0.75 para reduzir payload

### 2. `src/pages/admin/Caixa.tsx`
- No header (linha ~1541), trocar `flex items-center justify-between` por layout responsivo:
  - `flex flex-col gap-3` no container principal
  - Título e descrição em um bloco
  - Botões em outro bloco com `flex flex-wrap gap-2`
- Em mobile: título em cima, botões embaixo em linha
- Em desktop (`sm:`): manter lado a lado com `sm:flex-row sm:items-center sm:justify-between`

Layout mobile resultante:
```text
Caixa
Gerencie pagamentos de mesas e delivery

[Venda Avulsa]  [Atualizar]
```

**Total: 2 arquivos alterados**

