

# Plano: Corrigir erros de build + Notificação de atualização no PWA mobile

## Problemas identificados

1. **Erros de TypeScript** em 3 arquivos que impedem o build
2. **Barra de atualização não aparece** no app instalado no celular — causado pelo Service Worker servindo conteúdo cacheado, impedindo que o `fetch` de `version.json` e `index.html` retorne dados novos

## Parte 1: Corrigir erros de build

### 1.1 — `supabase/functions/deno.json`
Remover `"allowJs": true` das `compilerOptions` (não suportado pelo Deno).

### 1.2 — `src/pages/admin/Dashboard.tsx` (linhas 396-406)
As variáveis `produto`, `comanda`, `mesa` retornam `unknown` do `Map.get()`. Adicionar cast `as any` nos resultados de `.get()`:
```typescript
const produto = produtosMap.get(p.produto_id) as any;
const comanda = comandasMap.get(p.comanda_id) as any;
const mesa = comanda ? mesasMap.get(comanda.mesa_id) as any : null;
```

### 1.3 — `src/pages/admin/Pedidos.tsx` (linhas 220-223)
Mesmo problema — adicionar `as any` nos `.get()`:
```typescript
const comanda = comandasMap.get(pedido.comanda_id) as any;
const mesa = comanda ? mesasMap.get(comanda.mesa_id) as any : null;
const produto = produtosMap.get(pedido.produto_id) as any;
const categoria = produto ? categoriasMap.get(produto.categoria_id) as any : null;
```

### 1.4 — `src/pages/admin/Garcom.tsx` (linha 686)
`.rpc()` não retorna uma Promise com `.catch()`. Encapsular em `try/catch` ou usar `.then()`:
```typescript
await supabase.rpc('liberar_mesa', { p_mesa_id: selectedMesaForBaixa.id })
  .then(({ error }) => {
    if (error) {
      return supabase.from('mesas').update({ status: 'disponivel' }).eq('id', selectedMesaForBaixa.id);
    }
  });
```

## Parte 2: Notificação de atualização no PWA mobile

### Problema raiz
No app instalado (standalone), o Service Worker intercepta **todas** as requisições — incluindo os fetches de `version.json` e `index.html` usados para detectar atualizações. O `StaleWhileRevalidate` para `.html` e o `CacheFirst`/precache servem conteúdo antigo, fazendo com que a comparação de versão nunca detecte mudança.

### 2.1 — `src/sw.ts`: Excluir `version.json` do cache
Adicionar rota `NetworkOnly` para `version.json` antes das outras rotas, garantindo que sempre busque do servidor:
```typescript
import { NetworkOnly } from 'workbox-strategies';

registerRoute(
  ({ url }) => url.pathname === '/version.json',
  new NetworkOnly()
);
```

### 2.2 — `src/sw.ts`: Notificar clientes ao detectar nova versão no `activate`
O SW já faz `notifyClientsOfUpdate()` no activate — isso está correto. Mas o `skipWaiting()` no topo faz o SW ativar imediatamente, e nesse momento o app antigo pode não estar ouvindo. Reforçar com um `postMessage` após a ativação.

### 2.3 — `src/components/UpdateNotification.tsx`: Melhorar detecção mobile
- Adicionar verificação que, quando em modo `standalone` (PWA instalado), faz o fetch de `version.json` com `cache: 'no-store'` mais frequentemente (a cada 60s em vez de 30s — já está em 30s, ok).
- Remover a condição `if (showNotification) return;` dentro de `scheduleNotification` que usa estado stale (closure do `useEffect`). Usar `useRef` para controlar se já está mostrando.
- Garantir que `handleUpdate` limpe **todos** os caches do SW antes do reload:
```typescript
const handleUpdate = async () => {
  localStorage.removeItem('app_js_version');
  localStorage.removeItem('app_build_version');
  localStorage.removeItem('app_version_json');
  
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }
  
  // Limpar todos os caches
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  
  window.location.reload();
};
```

### 2.4 — `src/sw.ts`: Denegar `/version.json` na NavigationRoute denylist
Adicionar `/version\.json/` ao denylist para evitar que o NavigationRoute intercepte:
```typescript
denylist: [
  /^\/api\//,
  /^\/__/,
  /\/version\.json$/,
],
```

## Resumo de arquivos a editar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/deno.json` | Remover `allowJs` |
| `src/pages/admin/Dashboard.tsx` | Cast `as any` nos `.get()` |
| `src/pages/admin/Pedidos.tsx` | Cast `as any` nos `.get()` |
| `src/pages/admin/Garcom.tsx` | Substituir `.catch()` por `.then()` |
| `src/sw.ts` | NetworkOnly para `version.json`, denylist atualizada |
| `src/components/UpdateNotification.tsx` | Limpar caches no update, fix closure stale |

