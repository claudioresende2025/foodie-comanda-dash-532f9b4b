

# Correção: Erro "Failed to resolve import tesseract.js"

## Diagnóstico

O pacote `tesseract.js` está listado no `package.json` (v5.1.1), mas o Vite não consegue resolver o módulo. Isso indica que o pacote não foi instalado corretamente (falta no `node_modules`).

## Solução

O problema é que as dependências precisam ser reinstaladas. No Lovable, isso acontece automaticamente ao adicionar/remover um pacote no `package.json`.

### Abordagem: Forçar reinstalação
- Remover e re-adicionar `tesseract.js` no `package.json` para forçar o Lovable a reinstalar as dependências
- Alternativa: se o pacote continuar falhando, usar importação dinâmica (`import('tesseract.js')`) como fallback mais resiliente

### Arquivo: `package.json`
- Atualizar a versão de `tesseract.js` de `^5.1.1` para `^5.1.2` (ou qualquer bump minor) para forçar reinstalação

### Arquivo: `src/components/admin/MenuScannerModal.tsx` (melhoria opcional)
- Trocar import estático por dinâmico para evitar que o erro bloqueie toda a aplicação:
```tsx
// De: import Tesseract from 'tesseract.js';
// Para: const Tesseract = await import('tesseract.js');
```

Total: 2 arquivos, mudanças mínimas.

