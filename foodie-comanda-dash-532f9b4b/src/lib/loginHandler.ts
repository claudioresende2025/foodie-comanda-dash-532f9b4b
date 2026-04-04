/**
 * loginHandler.ts - Login Híbrido com PRIORIDADE OFFLINE TOTAL
 * 
 * REGRA CRÍTICA: Se navigator.onLine === false, PROIBIDO tentar Supabase
 * 
 * Fluxo de Login:
 * 1. OFFLINE TOTAL: Dexie → Servidor Local (backup)
 * 2. ONLINE: Supabase → Salvar no cache para próximo offline
 * 
 * O gerente PRECISA conseguir logar mesmo com roteador desligado.
 */

import { supabase } from '@/integrations/supabase/client';
// ============================================
// IMPORTS ESTÁTICOS PARA FUNCIONAR OFFLINE
// ============================================
import { db, ensureDbOpen } from '@/lib/db';
import { 
  validateOfflineLogin, 
  createOfflineSession,
  saveUserToCache
} from '@/lib/offlineAuth';

// Super Admin REQUER internet
const SUPER_ADMIN_EMAIL = 'claudinhoresendemoura@gmail.com';

// ==================== TIPOS ====================

export interface LoginResult {
  success: boolean;
  isOffline: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    nome: string;
    empresa_id: string | null;
    role: string;
    permissions?: any;
  };
  redirectTo?: string;
  daysRemaining?: number;
  emergencyToken?: string;
}

// ==================== HELPERS ====================

/**
 * Verifica se é um erro de rede/conexão
 */
function isNetworkError(error: any): boolean {
  if (!navigator.onLine) return true;
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('network') || 
         msg.includes('fetch') || 
         msg.includes('failed') ||
         msg.includes('timeout') ||
         msg.includes('connection') ||
         msg.includes('offline') ||
         msg.includes('err_') ||
         msg.includes('aborted');
}

/**
 * Dispara pre-cache das rotas principais no Service Worker
 */
function triggerRoutePrecache(): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'PRECACHE_ROUTES'
    });
    console.log('[LoginHandler] Pre-cache de rotas solicitado');
  }
}

/**
 * Calcula dias restantes de sessão offline
 */
function calculateDaysRemaining(lastOnlineAt: string): number {
  const lastOnline = new Date(lastOnlineAt);
  const daysSinceLastOnline = Math.floor(
    (Date.now() - lastOnline.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.max(0, 7 - daysSinceLastOnline);
}

/**
 * Determina a rota de redirecionamento baseado no role
 */
function getRedirectRoute(role: string, permissions?: any): string {
  if (role === 'motoboy') {
    return '/admin/entregador';
  }
  if (permissions?.canAccessAdmin !== false) {
    return '/admin';
  }
  return '/delivery';
}

// ==================== LOGIN VIA CACHE LOCAL (DEXIE) - PRINCIPAL ====================

/**
 * LOGIN OFFLINE VIA DEXIE
 * Esta é a função PRINCIPAL quando offline
 * Valida credenciais via hash SHA-256 e gera Token de Emergência
 */
export async function loginViaCache(email: string, password: string): Promise<LoginResult> {
  console.log('[LoginHandler] 🔐 Iniciando login via cache local (Dexie)...');
  
  try {
    // PASSO 1: Garantir banco aberto ANTES de qualquer operação
    console.log('[LoginHandler] 📂 Verificando estado do banco...');
    const isOpen = await ensureDbOpen();
    if (!isOpen) {
      console.error('[LoginHandler] ❌ Falha ao abrir banco de dados');
      return {
        success: false,
        isOffline: true,
        error: 'Banco de dados indisponível. Reinicie o aplicativo.',
      };
    }
    console.log('[LoginHandler] ✅ Banco de dados pronto');
    
    // PASSO 2: Validar credenciais via hash
    const result = await validateOfflineLogin(email, password);
    
    if (result.success && result.user) {
      console.log('[LoginHandler] ✅ Login offline válido:', result.user.email);
      
      // PASSO 3: Criar sessão offline com Token de Emergência
      createOfflineSession(result.user, result.emergencyToken);
      
      // PASSO 4: Salvar no localStorage para compatibilidade
      const offlineUser = {
        id: result.user.id,
        email: result.user.email,
        nome: result.user.nome,
        empresa_id: result.user.empresa_id,
        role: result.user.role,
        permissions: result.user.permissions
      };
      localStorage.setItem('offline_user', JSON.stringify(offlineUser));
      
      const daysRemaining = calculateDaysRemaining(result.user.last_online_at);
      
      return {
        success: true,
        isOffline: true,
        user: offlineUser,
        redirectTo: getRedirectRoute(result.user.role, result.user.permissions),
        daysRemaining,
        emergencyToken: result.emergencyToken,
      };
    }
    
    // Sessão expirada ou credenciais inválidas
    if (result.requiresOnlineLogin) {
      return {
        success: false,
        isOffline: true,
        error: result.error || 'Sessão expirada. Conecte-se online para revalidar.',
      };
    }
    
    // Senha incorreta
    return {
      success: false,
      isOffline: true,
      error: result.error || 'Senha incorreta',
    };
    
  } catch (err: any) {
    console.error('[LoginHandler] ❌ Erro no cache local:', err.message);
    
    // Se erro de banco fechado, tentar reabrir uma vez
    const errMsg = (err?.message || '').toLowerCase();
    if (errMsg.includes('invalidstateerror') || errMsg.includes('closed')) {
      console.log('[LoginHandler] 🔄 Banco fechado, tentando recuperação...');
      try {
        const reopened = await ensureDbOpen();
        if (reopened) {
          console.log('[LoginHandler] ✅ Banco reaberto, repetindo validação...');
          // Tentar novamente
          const result = await validateOfflineLogin(email, password);
          if (result.success && result.user) {
            createOfflineSession(result.user, result.emergencyToken);
            localStorage.setItem('offline_user', JSON.stringify({
              id: result.user.id,
              email: result.user.email,
              nome: result.user.nome,
              empresa_id: result.user.empresa_id,
              role: result.user.role,
              permissions: result.user.permissions
            }));
            return {
              success: true,
              isOffline: true,
              user: result.user,
              redirectTo: getRedirectRoute(result.user.role, result.user.permissions),
              emergencyToken: result.emergencyToken,
            };
          }
        }
      } catch (retryErr) {
        console.error('[LoginHandler] ❌ Recuperação falhou:', retryErr);
      }
    }
    
    return {
      success: false,
      isOffline: true,
      error: 'Erro ao acessar dados offline. Reinicie o aplicativo.',
    };
  }
}

// ==================== LOGIN VIA SERVIDOR LOCAL (BACKUP) ====================

/**
 * Tenta login no servidor local (PC do caixa na rede interna)
 * Usado como backup quando Dexie falha
 */
export async function loginViaLocalServer(email: string, password: string): Promise<LoginResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    console.log('[LoginHandler] 🌐 Tentando login no servidor local...');
    
    const response = await fetch('http://192.168.2.111:3000/api/local/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        console.log('[LoginHandler] ✅ Sucesso via servidor local');
        localStorage.setItem('offline_user', JSON.stringify(data.user));
        
        return {
          success: true,
          isOffline: true,
          user: data.user,
          redirectTo: '/admin',
        };
      }
    }
    
    return {
      success: false,
      isOffline: true,
      error: 'Servidor local não autorizou',
    };
    
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[LoginHandler] ⚠️ Servidor local inacessível:', err.message);
    return {
      success: false,
      isOffline: true,
      error: 'Servidor local inacessível',
    };
  }
}

// ==================== LOGIN PRINCIPAL ====================

/**
 * FUNÇÃO PRINCIPAL DE LOGIN
 * 
 * REGRA ABSOLUTA: Se navigator.onLine === false, PROIBIDO chamar Supabase
 * 
 * Fluxo:
 * 1. OFFLINE → Dexie DIRETO (prioridade) → Servidor Local (backup)
 * 2. SUPER ADMIN → Sempre online, erro se offline
 * 3. ONLINE → Supabase → Salvar cache → Em erro de rede, fallback offline
 */
export async function handleLoginWithOffline(
  email: string, 
  password: string,
  signInFn: (email: string, password: string) => Promise<{ error: Error | null }>
): Promise<LoginResult> {
  
  console.log('[LoginHandler] 🚀 handleLoginWithOffline iniciado');
  console.log('[LoginHandler] 📍 navigator.onLine:', navigator.onLine);
  console.log('[LoginHandler] 📧 Email:', email);
  
  // ==============================================
  // VERIFICAÇÃO SUPER ADMIN
  // ==============================================
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
    if (!navigator.onLine) {
      console.log('[LoginHandler] ❌ Super Admin requer internet');
      return {
        success: false,
        isOffline: true,
        error: 'Super Admin requer conexão com internet.',
      };
    }
    // Super Admin vai direto para Supabase (online flow abaixo)
    console.log('[LoginHandler] 🛡️ Super Admin detectado, usando flow online');
  }
  
  // ==============================================
  // CASO 1: OFFLINE TOTAL - PRIORIDADE MÁXIMA
  // ==============================================
  if (!navigator.onLine) {
    console.log('[LoginHandler] 📴 OFFLINE DETECTADO - Usando cache local EXCLUSIVAMENTE');
    console.log('[LoginHandler] ⛔ Supabase BLOQUEADO (navigator.onLine = false)');
    
    // TENTAR DEXIE PRIMEIRO (mais rápido, tem hash de senha)
    const cacheResult = await loginViaCache(email, password);
    if (cacheResult.success) {
      console.log('[LoginHandler] ✅ Login offline via Dexie bem-sucedido');
      return cacheResult;
    }
    
    // Se Dexie falhou mas não é erro de credencial, tentar servidor local
    if (cacheResult.error && !cacheResult.error.includes('Senha incorreta')) {
      console.log('[LoginHandler] 🌐 Dexie falhou, tentando servidor local...');
      const localServerResult = await loginViaLocalServer(email, password);
      if (localServerResult.success) {
        console.log('[LoginHandler] ✅ Login offline via servidor local bem-sucedido');
        return localServerResult;
      }
    }
    
    // Nenhum fallback funcionou
    console.log('[LoginHandler] ❌ Todos os métodos offline falharam');
    return {
      success: false,
      isOffline: true,
      error: cacheResult.error || 'Sem conexão. Faça login online pelo menos uma vez.',
    };
  }

  // ==============================================
  // CASO 2: ONLINE - Tentar Supabase
  // ==============================================
  try {
    console.log('[LoginHandler] 🌐 ONLINE - Tentando login via Supabase...');
    const { error } = await signInFn(email, password);

    if (error) {
      // Verificar se é erro de rede (pode ter caído durante a requisição)
      if (isNetworkError(error)) {
        console.log('[LoginHandler] ⚠️ Erro de rede detectado, usando fallback offline...');
        
        // Tentar cache Dexie
        const cacheResult = await loginViaCache(email, password);
        if (cacheResult.success) return cacheResult;
        
        // Tentar servidor local
        const localServerResult = await loginViaLocalServer(email, password);
        if (localServerResult.success) return localServerResult;
        
        return {
          success: false,
          isOffline: false,
          error: 'Erro de conexão. Verifique sua internet.',
        };
      }

      // Erro de credenciais inválidas
      if (error.message.includes('Invalid login credentials')) {
        console.log('[LoginHandler] ❌ Credenciais inválidas');
        return {
          success: false,
          isOffline: false,
          error: 'E-mail ou senha incorretos',
        };
      }

      // Outro erro - tentar fallback
      console.log('[LoginHandler] ⚠️ Erro Supabase, tentando alternativas...', error.message);
      
      const cacheResult = await loginViaCache(email, password);
      if (cacheResult.success) return cacheResult;
      
      const localServerResult = await loginViaLocalServer(email, password);
      if (localServerResult.success) return localServerResult;
      
      return {
        success: false,
        isOffline: false,
        error: 'Erro ao conectar. Tente novamente.',
      };
    }

    // ==============================================
    // LOGIN ONLINE SUCESSO - Salvar no cache
    // ==============================================
    console.log('[LoginHandler] ✅ Login Supabase bem-sucedido!');
    
    // Disparar pre-cache das rotas em background
    triggerRoutePrecache();
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (userData?.user) {
        // Buscar perfil e role
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.user.id)
          .single();
        
        let role = 'proprietario';
        if (profileData?.empresa_id) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userData.user.id)
            .eq('empresa_id', profileData.empresa_id)
            .single();
          if (roleData?.role) role = roleData.role;
        }
        
        // Salvar no cache Dexie com hash da senha
        await saveUserToCache({
          email: userData.user.email || email,
          id: userData.user.id,
          nome: profileData?.nome || email.split('@')[0],
          empresa_id: profileData?.empresa_id || null,
          role: role,
          password: password // Será hasheado, NÃO armazenado em texto
        });
        
        // Salvar também no localStorage para redundância
        localStorage.setItem('offline_user', JSON.stringify({
          id: userData.user.id,
          email: userData.user.email || email,
          nome: profileData?.nome || email.split('@')[0],
          empresa_id: profileData?.empresa_id || null,
          role: role,
        }));
        
        console.log('[LoginHandler] ✅ Usuário salvo no cache para login offline futuro');
      }
    } catch (cacheErr) {
      console.warn('[LoginHandler] ⚠️ Não foi possível salvar no cache:', cacheErr);
      // Não bloquear o login por causa disso
    }
    
    return {
      success: true,
      isOffline: false,
    };

  } catch (err: any) {
    // Exceção capturada - provavelmente erro de rede
    console.log('[LoginHandler] ⚠️ Exceção no login:', err.message);
    
    if (isNetworkError(err)) {
      console.log('[LoginHandler] 🔄 Erro de rede detectado, usando fallback offline...');
      
      const cacheResult = await loginViaCache(email, password);
      if (cacheResult.success) return cacheResult;
      
      const localServerResult = await loginViaLocalServer(email, password);
      if (localServerResult.success) return localServerResult;
    }
    
    return {
      success: false,
      isOffline: false,
      error: 'Erro ao conectar. Tente novamente.',
    };
  }
}

export default handleLoginWithOffline;
