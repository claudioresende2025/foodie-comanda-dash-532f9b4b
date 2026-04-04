/**
 * offlineAuth.ts - Sistema de Autenticação Offline TOTALMENTE AUTÔNOMO
 * 
 * REQUERIMENTOS CRÍTICOS (login sem internet = restaurante não para):
 * - Se navigator.onLine === false, PROIBIDO tentar Supabase
 * - Validação de senha via hash SHA-256 contra users_cache no Dexie
 * - Token de Emergência local se credenciais baterem
 * - Auto-reopen do Dexie antes de qualquer operação
 * - Persistência no localStorage para redundância
 */

// ==================== CONFIGURAÇÃO ====================

const CONFIG = {
  // Tempo máximo de sessão offline (24 horas em ms)
  SESSION_DURATION_MS: 24 * 60 * 60 * 1000,
  
  // Dias máximos sem conexão online antes de exigir relogin
  MAX_OFFLINE_DAYS: 7,
  
  // Salt fixo para hash (em produção, usar variável de ambiente)
  HASH_SALT: 'FoodComandaPro_2024_v1_',
  
  // Chaves de localStorage para redundância
  STORAGE_KEYS: {
    OFFLINE_SESSION: 'offline_session',
    OFFLINE_USER: 'offline_user',
    EMERGENCY_TOKEN: 'emergency_auth_token',
    LAST_LOGIN: 'last_successful_login',
  }
};

// Super Admin - REQUER internet obrigatória
const SUPER_ADMIN_EMAIL = 'claudinhoresendemoura@gmail.com';

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
  emergencyToken?: string;
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

/**
 * Gera Token de Emergência para sessão offline
 * Token único por sessão, expira em 24h
 */
export async function generateEmergencyToken(email: string, timestamp: number): Promise<string> {
  const combined = `EMERGENCY:${email.toLowerCase()}:${timestamp}:${Math.random().toString(36)}`;
  return generateHash(combined);
}

// ==================== ACESSO SEGURO AO DEXIE ====================

/**
 * Garante que o Dexie está aberto antes de qualquer operação
 * Se fechado, tenta reabrir. Se falhar, tenta recriar conexão.
 */
async function getDbSafe() {
  const { db, ensureDbOpen, safeDbOperation } = await import('./db');
  
  const isOpen = await ensureDbOpen();
  if (!isOpen) {
    throw new Error('Banco de dados offline indisponível');
  }
  
  return { db, safeDbOperation };
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
  // Super Admin NUNCA é cacheado
  if (userData.email.toLowerCase() === SUPER_ADMIN_EMAIL) {
    console.log('[OfflineAuth] Super Admin não é cacheado');
    return;
  }
  
  try {
    const { db, safeDbOperation } = await getDbSafe();
    
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

    await safeDbOperation(async () => {
      await db.users_cache.put(cacheData);
    });
    
    // REDUNDÂNCIA: Salvar também no localStorage
    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_LOGIN, JSON.stringify({
      email: cacheData.email,
      id: cacheData.id,
      nome: cacheData.nome,
      empresa_id: cacheData.empresa_id,
      role: cacheData.role,
      permissions: cacheData.permissions,
      cached_at: cacheData.cached_at,
    }));
    
    console.log('[OfflineAuth] ✅ Usuário salvo no cache:', userData.email);
  } catch (e) {
    console.error('[OfflineAuth] ❌ Erro ao salvar cache:', e);
    // Não propagar erro - login online já funcionou
  }
}

/**
 * Atualiza o timestamp de última conexão online
 */
export async function updateLastOnlineAt(email: string): Promise<void> {
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) return;
  
  try {
    const { db, safeDbOperation } = await getDbSafe();
    
    await safeDbOperation(async () => {
      const user = await db.users_cache.get(email.toLowerCase());
      if (user) {
        const now = new Date().toISOString();
        const sessionExpires = new Date(Date.now() + CONFIG.SESSION_DURATION_MS).toISOString();
        
        await db.users_cache.update(email.toLowerCase(), {
          last_online_at: now,
          session_expires_at: sessionExpires,
        });
        console.log('[OfflineAuth] ✅ Timestamp atualizado:', email);
      }
    });
  } catch (e) {
    console.error('[OfflineAuth] Erro ao atualizar timestamp:', e);
  }
}

// ==================== VALIDAÇÃO OFFLINE (CORE) ====================

/**
 * VALIDAÇÃO OFFLINE PRINCIPAL
 * Valida credenciais contra o cache local (Dexie)
 * Gera Token de Emergência se bem-sucedido
 */
export async function validateOfflineLogin(
  email: string,
  password: string
): Promise<OfflineLoginResult> {
  console.log('[OfflineAuth] 🔐 Iniciando validação offline para:', email);
  
  // Super Admin REQUER internet
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
    return {
      success: false,
      error: 'Super Admin requer conexão com internet.',
      requiresOnlineLogin: true,
    };
  }
  
  try {
    const { db, safeDbOperation } = await getDbSafe();
    
    const cachedUser = await safeDbOperation(async () => {
      return await db.users_cache.get(email.toLowerCase());
    });
    
    if (!cachedUser) {
      console.log('[OfflineAuth] ❌ Usuário não encontrado no cache');
      
      // FALLBACK: Tentar localStorage
      const lastLogin = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_LOGIN);
      if (lastLogin) {
        try {
          const parsed = JSON.parse(lastLogin);
          if (parsed.email?.toLowerCase() === email.toLowerCase()) {
            console.log('[OfflineAuth] ⚠️ Usuário encontrado no localStorage mas sem hash de senha');
            return {
              success: false,
              error: 'Faça login online para habilitar acesso offline.',
              requiresOnlineLogin: true,
            };
          }
        } catch {}
      }
      
      return {
        success: false,
        error: 'Usuário não encontrado. Faça login online primeiro.',
        requiresOnlineLogin: true,
      };
    }

    // Verificar se precisa revalidar online (X dias sem conexão)
    const lastOnline = new Date(cachedUser.last_online_at);
    const daysSinceLastOnline = Math.floor(
      (Date.now() - lastOnline.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceLastOnline > CONFIG.MAX_OFFLINE_DAYS) {
      console.log('[OfflineAuth] ⚠️ Sessão expirada por tempo:', daysSinceLastOnline, 'dias');
      return {
        success: false,
        error: `Sua sessão expirou. Você está offline há ${daysSinceLastOnline} dias. Conecte-se à internet para revalidar.`,
        requiresOnlineLogin: true,
      };
    }

    // VALIDAÇÃO CRÍTICA: Verificar hash da senha
    const passwordHash = await generatePasswordHash(email, password);
    
    if (passwordHash !== cachedUser.session_hash) {
      console.log('[OfflineAuth] ❌ Hash de senha não confere');
      return {
        success: false,
        error: 'Senha incorreta.',
      };
    }

    // ✅ CREDENCIAIS VÁLIDAS - Gerar Token de Emergência
    const now = Date.now();
    const emergencyToken = await generateEmergencyToken(email, now);
    
    // Atualizar sessão no cache
    const newExpires = new Date(now + CONFIG.SESSION_DURATION_MS).toISOString();
    
    await safeDbOperation(async () => {
      await db.users_cache.update(email.toLowerCase(), {
        session_expires_at: newExpires,
      });
    });
    
    // Atualizar objeto de retorno
    const updatedUser: OfflineUserCache = {
      ...cachedUser,
      session_expires_at: newExpires,
    };

    console.log('[OfflineAuth] ✅ Login offline válido! Token:', emergencyToken.slice(0, 16) + '...');
    
    return {
      success: true,
      user: updatedUser,
      emergencyToken,
    };

  } catch (e: any) {
    console.error('[OfflineAuth] ❌ Erro na validação:', e);
    
    // Se erro de banco, tentar fallback via localStorage
    const lastLogin = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_LOGIN);
    if (lastLogin) {
      try {
        const parsed = JSON.parse(lastLogin);
        if (parsed.email?.toLowerCase() === email.toLowerCase()) {
          console.log('[OfflineAuth] ⚠️ Banco indisponível, mas usuário existe no localStorage');
          return {
            success: false,
            error: 'Banco offline indisponível. Tente reiniciar o aplicativo.',
          };
        }
      } catch {}
    }
    
    return {
      success: false,
      error: 'Erro ao validar credenciais offline: ' + e.message,
    };
  }
}

/**
 * Verifica se o usuário tem um cache válido (para mostrar opção de login offline)
 */
export async function hasValidCache(email: string): Promise<boolean> {
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) return false;
  
  try {
    const { db, safeDbOperation } = await getDbSafe();
    
    const cachedUser = await safeDbOperation(async () => {
      return await db.users_cache.get(email.toLowerCase());
    });
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
 * Busca usuário do cache
 */
export async function getCachedUser(email: string): Promise<OfflineUserCache | null> {
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) return null;
  
  try {
    const { db, safeDbOperation } = await getDbSafe();
    
    return await safeDbOperation(async () => {
      const user = await db.users_cache.get(email.toLowerCase());
      return user || null;
    });
  } catch {
    return null;
  }
}

/**
 * Remove usuário do cache (logout)
 */
export async function clearUserCache(email: string): Promise<void> {
  try {
    const { db, safeDbOperation } = await getDbSafe();
    
    await safeDbOperation(async () => {
      await db.users_cache.delete(email.toLowerCase());
    });
    
    console.log('[OfflineAuth] ✅ Cache removido:', email);
  } catch (e) {
    console.error('[OfflineAuth] Erro ao limpar cache:', e);
  }
}

// ==================== SESSÃO OFFLINE ====================

export interface OfflineSession {
  user: OfflineUserCache;
  createdAt: string;
  expiresAt: string;
  isOfflineSession: true;
  emergencyToken?: string;
}

/**
 * Cria sessão offline no localStorage (fonte de verdade)
 */
export function createOfflineSession(user: OfflineUserCache, emergencyToken?: string): OfflineSession {
  const session: OfflineSession = {
    user,
    createdAt: new Date().toISOString(),
    expiresAt: user.session_expires_at,
    isOfflineSession: true,
    emergencyToken,
  };

  // ARMAZENAR EM MÚLTIPLOS LUGARES PARA REDUNDÂNCIA
  localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_SESSION, JSON.stringify(session));
  localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_USER, JSON.stringify({
    id: user.id,
    email: user.email,
    nome: user.nome,
    empresa_id: user.empresa_id,
    role: user.role,
    permissions: user.permissions,
  }));
  
  if (emergencyToken) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.EMERGENCY_TOKEN, emergencyToken);
  }
  
  console.log('[OfflineAuth] ✅ Sessão offline criada com sucesso');
  
  return session;
}

/**
 * Recupera sessão offline do localStorage
 */
export function getOfflineSession(): OfflineSession | null {
  try {
    const sessionStr = localStorage.getItem(CONFIG.STORAGE_KEYS.OFFLINE_SESSION);
    if (!sessionStr) return null;

    const session: OfflineSession = JSON.parse(sessionStr);
    
    // Verificar expiração
    if (new Date(session.expiresAt) < new Date()) {
      console.log('[OfflineAuth] Sessão offline expirada');
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
  localStorage.removeItem(CONFIG.STORAGE_KEYS.OFFLINE_SESSION);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.OFFLINE_USER);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.EMERGENCY_TOKEN);
  console.log('[OfflineAuth] ✅ Sessão offline limpa');
}

/**
 * Verifica se está em sessão offline
 */
export function isOfflineSession(): boolean {
  return getOfflineSession() !== null;
}

/**
 * Obtém dados básicos do usuário do localStorage (rápido, sem Dexie)
 */
export function getOfflineUserFromStorage(): { id: string; email: string; nome: string; empresa_id: string | null; role: string; permissions: UserPermissions } | null {
  try {
    const userStr = localStorage.getItem(CONFIG.STORAGE_KEYS.OFFLINE_USER);
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// ==================== EXPORTAÇÕES DE CONFIGURAÇÃO ====================

export const OfflineAuthConfig = {
  SESSION_DURATION_MS: CONFIG.SESSION_DURATION_MS,
  MAX_OFFLINE_DAYS: CONFIG.MAX_OFFLINE_DAYS,
  SUPER_ADMIN_EMAIL,
};
