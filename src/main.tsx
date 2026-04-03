import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { autoConnectToHub } from "./lib/hubClient";

// ============================================
// INICIALIZAÇÃO DO APP
// ============================================
const root = document.getElementById("root")!;
createRoot(root).render(<App />);

// ============================================
// CONEXÃO AUTOMÁTICA AO HUB LOCAL
// ============================================
setTimeout(() => {
  console.log('[HubClient] 🔄 Tentando conectar ao Hub Local...');
  autoConnectToHub().then((connected) => {
    if (connected) {
      console.log('[HubClient] ✅ Conectado ao Hub Local!');
    } else {
      console.log('[HubClient] ℹ️ Hub Local não disponível, usando Supabase diretamente');
    }
  }).catch((err) => {
    console.warn('[HubClient] ⚠️ Erro ao conectar:', err.message);
  });
}, 2000); // Aguardar 2s para garantir que app carregou

// ============================================
// SERVICE WORKER REGISTRATION - FORÇADO E AGRESSIVO
// ============================================
const SW_CONFIG = {
  prodPath: '/sw.js',
  devPath: '/dev-sw.js',
  scope: '/'
};

async function forceRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  console.log('[SW] 🚀 Iniciando registro FORÇADO do Service Worker...');
  console.log('[SW] navigator.onLine:', navigator.onLine);
  console.log('[SW] URL atual:', window.location.href);
  
  try {
    // Passo 1: Verificar se já existe um SW ativo
    const existingReg = await navigator.serviceWorker.getRegistration('/');
    if (existingReg) {
      console.log('[SW] 📝 SW existente encontrado:', {
        scope: existingReg.scope,
        active: existingReg.active?.state,
        waiting: existingReg.waiting?.state,
        installing: existingReg.installing?.state
      });
      
      // Se tem waiting SW, forçar skipWaiting
      if (existingReg.waiting) {
        console.log('[SW] ⏳ Enviando SKIP_WAITING para SW em espera...');
        existingReg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      
      // Forçar update
      console.log('[SW] 🔄 Forçando verificação de atualização...');
      await existingReg.update();
    }
    
    // Passo 2: Registrar/atualizar SW
    const registration = await navigator.serviceWorker.register(SW_CONFIG.prodPath, {
      scope: SW_CONFIG.scope,
      updateViaCache: 'none'
    });
    
    console.log('[SW] ✅ Service Worker REGISTRADO');
    console.log('[SW] Scope:', registration.scope);
    
    // Passo 3: Monitorar estado
    const reportState = () => {
      const states = {
        installing: registration.installing?.state || 'none',
        waiting: registration.waiting?.state || 'none',
        active: registration.active?.state || 'none'
      };
      console.log('[SW] Estados:', states);
      return states;
    };
    
    reportState();
    
    // Passo 4: Aguardar ativação
    if (registration.installing) {
      console.log('[SW] 📦 SW instalando...');
      registration.installing.addEventListener('statechange', (e) => {
        const sw = e.target as ServiceWorker;
        console.log('[SW] Estado mudou:', sw.state);
        if (sw.state === 'activated') {
          console.log('[SW] 🎉 SW ATIVADO com sucesso!');
          sw.postMessage({ type: 'PRECACHE_ROUTES' });
        }
      });
    }
    
    if (registration.waiting) {
      console.log('[SW] ⏳ SW aguardando, enviando SKIP_WAITING...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    if (registration.active) {
      console.log('[SW] 🎉 SW já está ATIVO!');
      registration.active.postMessage({ type: 'PRECACHE_ROUTES' });
    }
    
    // Passo 5: Forçar update periódico
    registration.update().catch(() => {});
    
    return registration;
    
  } catch (error: any) {
    console.error('[SW] ❌ Erro ao registrar /sw.js:', error);
    
    // Fallback para dev
    try {
      const devReg = await navigator.serviceWorker.register(SW_CONFIG.devPath, {
        scope: SW_CONFIG.scope,
        type: 'module'
      });
      console.log('[SW] ✅ SW DEV registrado:', devReg.scope);
      return devReg;
    } catch (devError) {
      console.error('[SW] ❌ Falha total no registro do SW:', devError);
      console.log('[SW] ⚠️ Sistema continuará SEM cache offline');
      return null;
    }
  }
}

if ('serviceWorker' in navigator) {
  const params = new URLSearchParams(window.location.search);
  
  // Kill-switch
  if (params.get('no-sw') === 'true') {
    console.info('[SW] 🛑 Kill-switch ativado: desregistrando SW');
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .catch(() => {});
    caches?.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .catch(() => {});
  } else {
    // Registrar SW assim que possível
    if (document.readyState === 'complete') {
      forceRegisterServiceWorker();
    } else {
      window.addEventListener('load', forceRegisterServiceWorker);
    }
    
    // Detectar mudança de controller
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[SW] 🔄 Novo controller ativo - recarregando...');
      window.location.reload();
    });
    
    // Log quando SW está pronto
    navigator.serviceWorker.ready.then((registration) => {
      console.log('[SW] 🎉 Service Worker PRONTO e ATIVO');
      console.log('[SW] 📍 Scope:', registration.scope);
      console.log('[SW] 🟢 Estado:', registration.active?.state);
      
      // Solicitar pre-cache
      registration.active?.postMessage({ type: 'PRECACHE_ROUTES' });
    });
  }
}
