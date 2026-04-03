/**
 * ============================================
 * FOOD COMANDA PRO - HUB CLIENT
 * ============================================
 * 
 * Cliente Socket.io para comunicação com o Local Hub
 * Detecta automaticamente se deve usar Supabase ou Hub Local
 */

import { io, Socket } from 'socket.io-client';

// ============================================
// CONFIGURAÇÃO
// ============================================

const HUB_PORT = 3001;

// IP do Hub Local (configurável via localStorage)
const getHubUrl = (): string => {
  const savedIp = localStorage.getItem('hub_ip') || '192.168.192.1';
  return `http://${savedIp}:${HUB_PORT}`;
};

// ============================================
// CLIENTE SOCKET.IO
// ============================================

let socket: Socket | null = null;
let hubConnected = false;
let hubUrl = '';

// Callbacks para eventos
type HubEventCallback = (data: any) => void;
const eventCallbacks: Map<string, Set<HubEventCallback>> = new Map();

/**
 * Conecta ao Local Hub via WebSocket
 */
export function connectToHub(ip?: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (socket?.connected) {
      console.log('[HubClient] Já conectado ao Hub');
      resolve(true);
      return;
    }
    
    hubUrl = ip ? `http://${ip}:${HUB_PORT}` : getHubUrl();
    console.log(`[HubClient] Conectando ao Hub: ${hubUrl}`);
    
    socket = io(hubUrl, {
      transports: ['websocket'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      console.log('[HubClient] ✅ Conectado ao Hub Local');
      hubConnected = true;
      
      // Salvar IP para reconexão futura
      if (ip) {
        localStorage.setItem('hub_ip', ip);
      }
      
      resolve(true);
    });
    
    socket.on('connect_error', (err) => {
      console.warn('[HubClient] ❌ Erro de conexão:', err.message);
      hubConnected = false;
      resolve(false);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('[HubClient] 🔌 Desconectado:', reason);
      hubConnected = false;
    });
    
    // Eventos do Hub
    socket.on('hub:status', (data) => {
      console.log('[HubClient] Status do Hub:', data);
      emitToCallbacks('hub:status', data);
    });
    
    socket.on('pedido:novo', (data) => {
      console.log('[HubClient] Novo pedido:', data.id);
      emitToCallbacks('pedido:novo', data);
    });
    
    socket.on('pedido:atualizado', (data) => {
      console.log('[HubClient] Pedido atualizado:', data.id);
      emitToCallbacks('pedido:atualizado', data);
    });
    
    socket.on('comanda:nova', (data) => {
      console.log('[HubClient] Nova comanda:', data.id);
      emitToCallbacks('comanda:nova', data);
    });
    
    socket.on('comanda:fechada', (data) => {
      console.log('[HubClient] Comanda fechada:', data.id);
      emitToCallbacks('comanda:fechada', data);
    });
    
    socket.on('mesa:atualizada', (data) => {
      console.log('[HubClient] Mesa atualizada:', data.id);
      emitToCallbacks('mesa:atualizada', data);
    });
    
    socket.on('garcom:chamado', (data) => {
      console.log('[HubClient] Garçom chamado:', data.numero);
      emitToCallbacks('garcom:chamado', data);
    });
    
    socket.on('connection:restored', () => {
      console.log('[HubClient] 🌐 Internet restaurada no Hub');
      emitToCallbacks('connection:restored', {});
    });
    
    socket.on('connection:lost', () => {
      console.log('[HubClient] 📴 Internet perdida no Hub');
      emitToCallbacks('connection:lost', {});
    });
    
    socket.on('sync:download_complete', (data) => {
      console.log('[HubClient] 📥 Download do Supabase concluído');
      emitToCallbacks('sync:download_complete', data);
    });
    
    socket.on('sync:upload_complete', (data) => {
      console.log('[HubClient] 📤 Upload para Supabase concluído');
      emitToCallbacks('sync:upload_complete', data);
    });
    
    // Timeout de conexão
    setTimeout(() => {
      if (!hubConnected) {
        console.log('[HubClient] ⏱️ Timeout de conexão');
        resolve(false);
      }
    }, 5000);
  });
}

/**
 * Desconecta do Hub
 */
export function disconnectFromHub(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    hubConnected = false;
    console.log('[HubClient] Desconectado do Hub');
  }
}

/**
 * Verifica se está conectado ao Hub
 */
export function isHubConnected(): boolean {
  return hubConnected && socket?.connected === true;
}

/**
 * Obtém a URL do Hub atual
 */
export function getHubUrlCurrent(): string {
  return hubUrl;
}

// ============================================
// EMISSÃO DE EVENTOS
// ============================================

function emitToCallbacks(event: string, data: any): void {
  const callbacks = eventCallbacks.get(event);
  if (callbacks) {
    callbacks.forEach(cb => cb(data));
  }
}

/**
 * Registra callback para evento do Hub
 */
export function onHubEvent(event: string, callback: HubEventCallback): () => void {
  if (!eventCallbacks.has(event)) {
    eventCallbacks.set(event, new Set());
  }
  eventCallbacks.get(event)!.add(callback);
  
  // Retorna função para remover callback
  return () => {
    eventCallbacks.get(event)?.delete(callback);
  };
}

/**
 * Envia evento para o Hub
 */
export function emitToHub(event: string, data: any): boolean {
  if (!socket?.connected) {
    console.warn('[HubClient] Não conectado ao Hub');
    return false;
  }
  
  socket.emit(event, data);
  return true;
}

// ============================================
// AÇÕES DO HUB
// ============================================

/**
 * Configura a empresa no Hub
 */
export function configureHubEmpresa(empresaId: string): void {
  emitToHub('config:empresa', { empresa_id: empresaId });
}

/**
 * Cria pedido via Hub
 */
export function createPedidoViaHub(pedido: {
  comanda_id: string;
  produto_id: string;
  quantidade: number;
  observacoes?: string;
  empresa_id?: string;
}): boolean {
  return emitToHub('pedido:criar', pedido);
}

/**
 * Atualiza status do pedido via Hub
 */
export function updatePedidoStatusViaHub(pedidoId: string, status: string): boolean {
  return emitToHub('pedido:status', { id: pedidoId, status });
}

/**
 * Chama garçom via Hub
 */
export function chamarGarcomViaHub(mesaId: string, numero: number | string): boolean {
  return emitToHub('mesa:chamar_garcom', { mesa_id: mesaId, numero });
}

/**
 * Solicita dados atualizados do Hub
 */
export function requestHubData(): void {
  emitToHub('sync:request', {});
}

/**
 * Força sincronização no Hub
 */
export function forceHubSync(): void {
  emitToHub('sync:force', {});
}

// ============================================
// API HÍBRIDA (SUPABASE + HUB)
// ============================================

/**
 * Determina qual API usar (Supabase ou Hub Local)
 */
export function getApiBaseUrl(): string {
  // Se offline, usar Hub Local
  if (!navigator.onLine && hubConnected) {
    return hubUrl;
  }
  
  // Se online, preferir Supabase
  return import.meta.env.VITE_SUPABASE_URL || 'https://tqmunlilydcowndqxiir.supabase.co';
}

/**
 * Fetch híbrido - tenta Supabase primeiro, depois Hub Local
 */
export async function hybridFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const hubEndpoint = `${hubUrl}/api${endpoint}`;
  
  // Se offline, vai direto pro Hub
  if (!navigator.onLine) {
    if (hubConnected) {
      return fetch(hubEndpoint, options);
    }
    throw new Error('Sem conexão com internet ou Hub Local');
  }
  
  // Se online, tenta endpoint normal primeiro
  try {
    const response = await fetch(endpoint, {
      ...options,
      signal: AbortSignal.timeout(5000)
    });
    return response;
  } catch (err) {
    // Fallback para Hub Local
    if (hubConnected) {
      console.log('[HybridFetch] Fallback para Hub Local');
      return fetch(hubEndpoint, options);
    }
    throw err;
  }
}

// ============================================
// HOOK DE AUTO-CONEXÃO
// ============================================

let autoConnectAttempted = false;

/**
 * Tenta conectar automaticamente ao Hub ao iniciar
 */
export async function autoConnectToHub(): Promise<boolean> {
  if (autoConnectAttempted) return isHubConnected();
  autoConnectAttempted = true;
  
  console.log('[HubClient] Tentando conexão automática...');
  
  // Tentar IP salvo primeiro
  const savedIp = localStorage.getItem('hub_ip');
  if (savedIp) {
    const connected = await connectToHub(savedIp);
    if (connected) return true;
  }
  
  // Tentar IPs comuns de rede local
  const commonIps = [
    '192.168.192.1',  // IP padrão do Hub
    '192.168.1.100',
    '192.168.1.1',
    '192.168.0.100',
    '192.168.0.1',
    '192.168.2.111',
    'localhost'
  ];
  
  for (const ip of commonIps) {
    console.log(`[HubClient] Tentando ${ip}...`);
    const connected = await connectToHub(ip);
    if (connected) {
      console.log(`[HubClient] ✅ Hub encontrado em ${ip}`);
      return true;
    }
  }
  
  console.log('[HubClient] ⚠️ Hub Local não encontrado');
  return false;
}

// Exportar instância do socket para uso direto se necessário
export { socket };
