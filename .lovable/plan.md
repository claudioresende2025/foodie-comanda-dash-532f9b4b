

# Correcao: Barra de Atualizacao Nao Aparece

## Problema

A barra verde "Nova atualizacao disponivel!" depende 100% do Service Worker detectar uma versao nova em espera (`waiting`). Se o SW nao estiver ativo (como no preview do Lovable em iframe) ou se o navegador nao disparar o evento `updatefound`, a barra nunca aparece.

## Causa Raiz

O componente `UpdateNotification` so mostra a barra quando:
1. `registration.waiting` existe (SW novo instalado esperando), OU
2. O evento `statechange` do SW muda para `installed`

No ambiente de preview (iframe), Service Workers frequentemente nao funcionam. Alem disso, ha um bug de closure: a funcao `triggerShowWithDelay` referencia `showTimer` do render inicial, pois o `useEffect` tem dependencias vazias `[]`.

## Solucao

Adicionar um mecanismo complementar de deteccao de versao baseado em **build timestamp**. Independente do SW, o componente compara o timestamp do build atual com o armazenado localmente. Se diferir, mostra a barra.

### Alteracoes

| Arquivo | O que muda |
|---------|-----------|
| `src/components/UpdateNotification.tsx` | Adicionar verificacao por build version alem do SW. Corrigir bug de closure do `triggerShowWithDelay` usando `useRef`. |
| `vite.config.ts` | Adicionar `define` com `__BUILD_TIMESTAMP__` para injetar timestamp do build. |

### Detalhes Tecnicos

**vite.config.ts** - Injetar timestamp do build:
```typescript
define: {
  '__BUILD_TIMESTAMP__': JSON.stringify(Date.now().toString()),
}
```

**UpdateNotification.tsx** - Adicionar deteccao por versao:
```typescript
// Ao montar, verificar se o build mudou
const currentBuild = (window as any).__BUILD_TIMESTAMP__ || '';
const lastBuild = localStorage.getItem('app_build_version');

if (lastBuild && lastBuild !== currentBuild) {
  // Build novo detectado - mostrar notificacao
  setShowNotification(true);
  sessionStorage.setItem('update_available', '1');
}

// Ao clicar em "Atualizar", salvar a versao atual
localStorage.setItem('app_build_version', currentBuild);
```

**Correcao do bug de closure** - Usar `useRef` para o timer:
```typescript
const showTimerRef = useRef<number | null>(null);

const triggerShowWithDelay = () => {
  if (showTimerRef.current) return;
  showTimerRef.current = window.setTimeout(() => {
    setShowNotification(true);
    showTimerRef.current = null;
  }, 10000);
};
```

### Fluxo Resultante

```text
App carrega
  |
  +-- Verifica SW waiting? -> SIM -> mostra barra (10s delay)
  |
  +-- Verifica build timestamp mudou? -> SIM -> mostra barra imediatamente
  |
  +-- SW detecta updatefound -> mostra barra (10s delay)
  |
  +-- Nenhuma mudanca -> nao mostra nada
```

### Resultado Esperado

1. Apos qualquer modificacao de codigo, o build gera um novo timestamp
2. Na proxima vez que o usuario abre o app, detecta que o timestamp mudou
3. Barra verde aparece com "Nova atualizacao disponivel!"
4. Ao clicar "Atualizar", salva o timestamp atual e recarrega
5. Funciona com ou sem Service Worker ativo

