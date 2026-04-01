/**
 * offlineAuth.ts - Sistema de Autenticação Offline Seguro
 * 
 * Este módulo gerencia login offline com:
 * - Hash seguro de credenciais (SHA-256)
 * - Validação de sessão com expiração
 * - Controle de permissões por role
 * - Revalidação obrigatória após X dias offline
 */

// ==================== CONFIGURAÇÃO ====================

const CONFIG = {
  // Tempo máximo de sessão offline (24 horas em ms)
  SESSION_DURATION_MS: 24 * 60 * 60 * 1000,
  
  // Dias máximos sem conexão online antes de exigir relogin
  MAX_OFFLINE_DAYS: 7,
  
  // Salt fixo para hash (em produção, usar variável de ambiente)
  HASH_SALT: 'FoodComandaPro_2024_v1_',
};

// ==================== TIPOS ====================

export interface OfflineUserCache {
  email: string;
  id: string;
  nome: string;
  empresa_id: string | null;
  role: string;
  session_hash: string;
  permissions: UserPermissions;
  cached_at: string;
  last_online_at: string;
  session_expires_at: string;
}

export interface UserPermissions {
  canViewFaturamento: boolean;
  canViewRelatorios: boolean;
  canManageTeam: boolean;
  canManageProdutos: boolean;
  canManageMesas: boolean;
  canOperateCaixa: boolean;
  canTakeOrders: boolean;
  canDelivery: boolean;
  canAccessAdmin: boolean;
}

export interface OfflineLoginResult {
  success: boolean;
  user?: OfflineUserCache;
  error?: string;
  requiresOnlineLogin?: boolean;
}

// ==================== FUNÇÕES DE HASH ====================

/**
 * Gera um hash SHA-256 a partir de uma string
 */
export async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(CONFIG.HASH_SALT + input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Gera hash de sessão baseado em email + senha + timestamp
 * Este hash serve para validar o login offline
 */
export async function generateSessionHash(email: string, password: string): Promise<string> {
  // Combina email e senha com timestamp do dia (muda a cada 24h)
  const dayTimestamp = Math.floor(Date.now() / CONFIG.SESSION_DURATION_MS);
  const combined = `${email.toLowerCase()}:${password}:${dayTimestamp}`;
  return generateHash(combined);
}

/**
 * Gera hash de senha persistente (não muda com o tempo)
 * Usado para verificar se a senha é a mesma do cache
 */
export async function generatePasswordHash(email: string, password: string): Promise<string> {
  const combined = `${email.toLowerCase()}:${password}`;
  return generateHash(combined);
}

// ==================== PERMISSÕES POR ROLE ====================

/**
 * Retorna as permissões baseadas no role do usuário
 */
export function getPermissionsByRole(role: string): UserPermissions {
  const rolePermissions: Record<string, UserPermissions> = {
    proprietario: {
      canViewFaturamento: true,
      canViewRelatorios: true,
      canManageTeam: true,
      canManageProdutos: true,
      canManageMesas: true,
      canOperateCaixa: true,
      canTakeOrders: true,
      canDelivery: false,
      canAccessAdmin: true,
    },
    gerente: {
      canViewFaturamento: true,
      canViewRelatorios: true,
      canManageTeam: true,
      canManageProdutos: true,
      canManageMesas: true,
      canOperateCaixa: true,
      canTakeOrders: true,
      canDelivery: false,
      canAccessAdmin: true,
    },
    caixa: {
      canViewFaturamento: false,
      canViewRelatorios: false,
      canManageTeam: false,
      canManageProdutos: false,
      canManageMesas: true,
      canOperateCaixa: true,
      canTakeOrders: true,
      canDelivery: false,
      canAccessAdmin: true,
    },
    garcom: {
      canViewFaturamento: false,
      canViewRelatorios: false,
      canManageTeam: false,
      canManageProdutos: false,
      canManageMesas: true,
      canOperateCaixa: false,
      canTakeOrders: true,
      canDelivery: false,
      canAccessAdmin: true,
    },
    motoboy: {
      canViewFaturamento: false,
      canViewRelatorios: false,
      canManageTeam: false,
      canManageProdutos: false,
      canManageMesas: false,
      canOperateCaixa: false,
      canTakeOrders: false,
      canDelivery: true,
      canAccessAdmin: true,
    },
    cliente: {
      canViewFaturamento: false,
      canViewRelatorios: false,
      canManageTeam: false,
      canManageProdutos: false,
      canManageMesas: false,
      canOperateCaixa: false,
      canTakeOrders: false,
      canDelivery: false,
      canAccessAdmin: false,
    },
  };

  return rolePermissions[role] || rolePermissions.cliente;
}

// ==================== CACHE DE USUÁRIO ====================

/**
 * Salva usuário no cache para login offline futuro
 * Chamado após login online bem-sucedido
 */
export async function saveUserToCache(userData: {
  email: string;
  id: string;
  nome: string;
  empresa_id: string | null;
  role: string;
  password: string; // Senha em texto será hasheada, não armazenada
}): Promise<void> {
  const { db } = await import('./db');
  
  const passwordHash = await generatePasswordHash(userData.email, userData.password);
  const permissions = getPermissionsByRole(userData.role);
  const now = new Date().toISOString();
  const sessionExpires = new Date(Date.now() + CONFIG.SESSION_DURATION_MS).toISOString();

  const cacheData: OfflineUserCache = {
    email: userData.email.toLowerCase(),
    id: userData.id,
    nome: userData.nome || userData.email.split('@')[0],
    empresa_id: userData.empresa_id,
    role: userData.role || 'proprietario',
    session_hash: passwordHash,
    permissions,
    cached_at: now,
    last_online_at: now,
    session_expires_at: sessionExpires,
  };

  try {
    await db.users_cache.put(cacheData);
    console.log('[OfflineAuth] ✓ Usuário salvo no cache:', userData.email);
  } catch (e) {
    console.error('[OfflineAuth] Erro ao salvar cache:', e);
  }
}

/**
 * Atualiza o timestamp de última conexão online
 */
export async function updateLastOnlineAt(email: string): Promise<void> {
  const { db } = await import('./db');
  
  try {
    const user = await db.users_cache.get(email.toLowerCase());
    if (user) {
      const now = new Date().toISOString();
      const sessionExpires = new Date(Date.now() + CONFIG.SESSION_DURATION_MS).toISOString();
      
      await db.users_cache.update(email.toLowerCase(), {
        last_online_at: now,
        session_expires_at: sessionExpires,
      });
      console.log('[OfflineAuth] ✓ Timestamp atualizado:', email);
    }
  } catch (e) {
    console.error('[OfflineAuth] Erro ao atualizar timestamp:', e);
  }
}

// ==================== VALIDAÇÃO OFFLINE ====================

/**
 * Valida login offline contra o cache local
 */
export async function validateOfflineLogin(
  email: string,
  password: string
): Promise<OfflineLoginResult> {
  const { db } = await import('./db');
  
  try {
    const cachedUser = await db.users_cache.get(email.toLowerCase());
    
    if (!cachedUser) {
      return {
        success: false,
        error: 'Usuário não encontrado no cache. Faça login online primeiro.',
        requiresOnlineLogin: true,
      };
    }

    // Verificar se precisa revalidar online (X dias sem conexão)
    const lastOnline = new Date(cachedUser.last_online_at);
    const daysSinceLastOnline = Math.floor(
      (Date.now() - lastOnline.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceLastOnline > CONFIG.MAX_OFFLINE_DAYS) {
      return {
        success: false,
        error: `Sua sessão expirou. Você está offline há ${daysSinceLastOnline} dias. Conecte-se à internet para revalidar.`,
        requiresOnlineLogin: true,
      };
    }

    // Verificar hash da senha
    const passwordHash = await generatePasswordHash(email, password);
    
    if (passwordHash !== cachedUser.session_hash) {
      return {
        success: false,
        error: 'Senha incorreta.',
      };
    }

    // Verificar expiração da sessão (24h)
    const sessionExpires = new Date(cachedUser.session_expires_at);
    if (Date.now() > sessionExpires.getTime()) {
      // Sessão expirada mas hash válido - renovar sessão
      const newExpires = new Date(Date.now() + CONFIG.SESSION_DURATION_MS).toISOString();
      await db.users_cache.update(email.toLowerCase(), {
        session_expires_at: newExpires,
      });
      
      // Atualizar objeto de retorno
      cachedUser.session_expires_at = newExpires;
    }

    console.log('[OfflineAuth] ✓ Login offline válido:', email);
    
    return {
      success: true,
      user: cachedUser as OfflineUserCache,
    };

  } catch (e: any) {
    console.error('[OfflineAuth] Erro na validação:', e);
    return {
      success: false,
      error: 'Erro ao validar credenciais offline.',
    };
  }
}

/**
 * Verifica se o usuário tem um cache válido (para mostrar opção de login offline)
 */
export async function hasValidCache(email: string): Promise<boolean> {
  const { db } = await import('./db');
  
  try {
    const cachedUser = await db.users_cache.get(email.toLowerCase());
    if (!cachedUser) return false;

    // Verificar dias offline
    const lastOnline = new Date(cachedUser.last_online_at);
    const daysSinceLastOnline = Math.floor(
      (Date.now() - lastOnline.getTime()) / (24 * 60 * 60 * 1000)
    );

    return daysSinceLastOnline <= CONFIG.MAX_OFFLINE_DAYS;
  } catch {
    return false;
  }
}

/**
 * Busca usuário do cache (compatibilidade com código antigo)
 */
export async function getCachedUser(email: string): Promise<OfflineUserCache | null> {
  const { db } = await import('./db');
  
  try {
    const user = await db.users_cache.get(email.toLowerCase());
    return user || null;
  } catch {
    return null;
  }
}

/**
 * Remove usuário do cache (logout)
 */
export async function clearUserCache(email: string): Promise<void> {
  const { db } = await import('./db');
  
  try {
    await db.users_cache.delete(email.toLowerCase());
    console.log('[OfflineAuth] ✓ Cache removido:', email);
  } catch (e) {
    console.error('[OfflineAuth] Erro ao limpar cache:', e);
  }
}

// ==================== SESSÃO OFFLINE ====================

const OFFLINE_SESSION_KEY = 'offline_session';

export interface OfflineSession {
  user: OfflineUserCache;
  createdAt: string;
  expiresAt: string;
  isOfflineSession: true;
}

/**
 * Cria sessão offline no localStorage
 */
export function createOfflineSession(user: OfflineUserCache): OfflineSession {
  const session: OfflineSession = {
    user,
    createdAt: new Date().toISOString(),
    expiresAt: user.session_expires_at,
    isOfflineSession: true,
  };

  localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
  console.log('[OfflineAuth] ✓ Sessão offline criada');
  
  return session;
}

/**
 * Recupera sessão offline do localStorage
 */
export function getOfflineSession(): OfflineSession | null {
  try {
    const sessionStr = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!sessionStr) return null;

    const session: OfflineSession = JSON.parse(sessionStr);
    
    // Verificar expiração
    if (new Date(session.expiresAt) < new Date()) {
      clearOfflineSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Limpa sessão offline
 */
export function clearOfflineSession(): void {
  localStorage.removeItem(OFFLINE_SESSION_KEY);
  localStorage.removeItem('offline_user');
  console.log('[OfflineAuth] ✓ Sessão offline limpa');
}

/**
 * Verifica se está em sessão offline
 */
export function isOfflineSession(): boolean {
  return getOfflineSession() !== null;
}

// ==================== EXPORTAÇÕES DE CONFIGURAÇÃO ====================

export const OfflineAuthConfig = {
  SESSION_DURATION_MS: CONFIG.SESSION_DURATION_MS,
  MAX_OFFLINE_DAYS: CONFIG.MAX_OFFLINE_DAYS,
};
