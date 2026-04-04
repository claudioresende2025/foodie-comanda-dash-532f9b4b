// ===========================================
// STUB: Versão offline removida
// Este arquivo existe apenas para compatibilidade
// Todas as operações agora vão direto para Supabase
// ===========================================

// Mock do Dexie que retorna arrays vazios / no-ops
const noopTable = {
  where: () => noopTable,
  equals: () => noopTable,
  toArray: async () => [],
  first: async () => null,
  put: async () => {},
  bulkPut: async () => {},
  update: async () => {},
  delete: async () => {},
  count: async () => 0,
};

export const db = {
  isOpen: () => false,
  mesas: noopTable,
  comandas: noopTable,
  pedidos: noopTable,
  produtos: noopTable,
  categorias: noopTable,
  empresa: noopTable,
  vendas_concluidas: noopTable,
  chamadas_garcom: noopTable,
  pedidos_delivery: noopTable,
  user_roles: noopTable,
  profiles: noopTable,
  config_delivery: noopTable,
  taxas_bairro: noopTable,
  clientes_delivery: noopTable,
};

// Funções de sincronização que não fazem nada
export async function sincronizarTudo() {
  console.log('[db stub] sincronizarTudo - offline removido');
  return { success: true, synced: 0 };
}

export async function baixarDadosIniciais(empresaId) {
  console.log('[db stub] baixarDadosIniciais - offline removido');
  return true;
}

export async function ensureDbOpen() {
  return true;
}

export async function initializeDb() {
  return true;
}

export default db;
