// ===========================================
// STUB: ConnectionManager removido (versão offline removida)
// Este arquivo existe apenas para compatibilidade
// ===========================================

export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'checking';

export interface ConnectionState {
  status: ConnectionStatus;
  lastOnline: Date | null;
  lastSync: Date | null;
  pendingCount: number;
  supabaseReachable: boolean;
  internetAvailable: boolean;
}

type ConnectionListener = (state: ConnectionState) => void;
type OnConnectionRestoredCallback = () => void;

class ConnectionManager {
  private state: ConnectionState = {
    status: 'online',
    lastOnline: new Date(),
    lastSync: new Date(),
    pendingCount: 0,
    supabaseReachable: true,
    internetAvailable: true,
  };

  init(): void {
    console.log('[ConnectionManager stub] Versão offline removida');
  }

  destroy(): void {}

  subscribe(listener: ConnectionListener): () => void {
    listener(this.state);
    return () => {};
  }

  onConnectionRestored(callback: OnConnectionRestoredCallback): () => void {
    return () => {};
  }

  getState(): ConnectionState {
    return this.state;
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  setEmpresaId(id: string): void {}

  async forceCheck(): Promise<void> {}

  async forceSync(): Promise<void> {}
}

export const connectionManager = new ConnectionManager();
export default connectionManager;
