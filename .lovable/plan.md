

# Correção: "Enviar Imagem" abrindo câmera em vez da galeria

## Problema

O `<input>` de upload de arquivo possui o atributo `capture="environment"` (linha 503), que em dispositivos móveis força a abertura da câmera ao invés da galeria de fotos.

## Solução

Remover o atributo `capture="environment"` do input de upload de arquivo. Sem esse atributo, o navegador móvel abrirá o seletor padrão que permite escolher imagens da galeria.

O atributo `capture` deve existir apenas no input usado para a funcionalidade "Usar Câmera", não no "Enviar Imagem".

### `src/components/admin/MenuScannerModal.tsx`
- Linha 503: remover `capture="environment"` do input referenciado por `fileInputRef`

**Total: 1 arquivo, 1 linha removida.**

