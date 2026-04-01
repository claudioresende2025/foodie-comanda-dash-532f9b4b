/**
 * loginHandler.ts - Lógica de Login Híbrido (Online + Offline)
 * 
 * Este módulo gerencia o fluxo de login com fallback offline:
 * 1. Verifica se está online
 * 2. Se offline, vai direto para cache local (Dexie)
 * 3. Se online, tenta Supabase primeiro
 * 4. Em caso de erro de rede, usa fallback offline
 * 5. Em sucesso online, salva dados no cache para futuro uso offline
 */

import { supabase } from '@/integrations/supabase/client';

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
 * Calcula dias restantes de sessão offline
 */
function calculateDaysRemaining(lastOnlineAt: string): number {
  const lastOnline = new Date(lastOnlineAt);
  const daysSinceLastOnline = Math.floor(
    (Date.now() - lastOnline.getTime()) / (24 * 60 * 60 * 1000)
  );
  return 7 - daysSinceLastOnline;
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

// ==================== LOGIN VIA CACHE LOCAL (DEXIE) ====================

/**
 * Tenta fazer login usando o cache local (Dexie)
 */
export async function loginViaCache(email: string, password: string): Promise<LoginResult> {
  try {
    console.log('[LoginHandler] Tentando login via cache local (Dexie)...');
    
    const { validateOfflineLogin, createOfflineSession } = await import('@/lib/offlineAuth');
    const { db } = await import('@/lib/db');
    
    // Verificar se usuário existe no cache
    const cachedUser = await db.users_cache.get(email.toLowerCase());
    
    if (!cachedUser) {
      console.log('[LoginHandler] Usuario nao encontrado no cache');
      return {
        success: false,
        isOffline: true,
        error: 'Usuario nao encontrado. Faca login online primeiro.',
      };
    }
    
    // Validar credenciais com hash seguro
    const result = await validateOfflineLogin(email, password);
    
    if (result.success && result.user) {
      console.log('[LoginHandler] Login offline valido:', result.user.email);
      
      // Criar sessão offline
      createOfflineSession(result.user);
      
      // Salvar no localStorage para compatibilidade
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
      };
    }
    
    // Sessão expirada?
    if (result.requiresOnlineLogin) {
      return {
        success: false,
        isOffline: true,
        error: result.error || 'Sessao expirada. Conecte-se online para revalidar.',
      };
    }
    
    // Senha incorreta
    return {
      success: false,
      isOffline: true,
      error: 'Senha incorreta',
    };
    
  } catch (err: any) {
    console.error('[LoginHandler] Erro no cache local:', err.message);
    return {
      success: false,
      isOffline: true,
      error: 'Erro ao acessar cache local: ' + err.message,
    };
  }
}

// ==================== LOGIN VIA SERVIDOR LOCAL ====================

/**
 * Tenta login no servidor local (PC do caixa na rede interna)
 */
export async function loginViaLocalServer(email: string, password: string): Promise<LoginResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    console.log('[LoginHandler] Tentando login no servidor local...');
    
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
        console.log('[LoginHandler] Sucesso via servidor local');
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
      error: 'Servidor local nao autorizou',
    };
    
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[LoginHandler] Servidor local inacessivel:', err.message);
    return {
      success: false,
      isOffline: true,
      error: 'Servidor local inacessivel',
    };
  }
}

// ==================== LOGIN PRINCIPAL ====================

/**
 * Função principal de login com fallback offline
 * 
 * Fluxo:
 * 1. Se offline -> tenta servidor local -> tenta cache Dexie
 * 2. Se online -> tenta Supabase
 *    - Se erro de rede -> fallback offline
 *    - Se sucesso -> salva no cache para próximo acesso offline
 */
export async function handleLoginWithOffline(
  email: string, 
  password: string,
  signInFn: (email: string, password: string) => Promise<{ error: Error | null }>
): Promise<LoginResult> {
  
  // ==============================================
  // CASO 1: OFFLINE - Ir direto para cache local
  // ==============================================
  if (!navigator.onLine) {
    console.log('[LoginHandler] Dispositivo offline - usando cache local...');
    
    // Tentar servidor local primeiro (pode estar numa rede interna)
    const localServerResult = await loginViaLocalServer(email, password);
    if (localServerResult.success) return localServerResult;
    
    // Tentar cache Dexie
    const cacheResult = await loginViaCache(email, password);
    if (cacheResult.success) return cacheResult;
    
    // Nenhum fallback funcionou
    return {
      success: false,
      isOffline: true,
      error: cacheResult.error || 'Sem conexao. Faca login online primeiro.',
    };
  }

  // ==============================================
  // CASO 2: ONLINE - Tentar Supabase primeiro
  // ==============================================
  try {
    console.log('[LoginHandler] Tentando login via Supabase...');
    const { error } = await signInFn(email, password);

    if (error) {
      // Verificar se é erro de rede
      if (isNetworkError(error)) {
        console.log('[LoginHandler] Erro de rede no Supabase, usando fallback...');
        
        const localServerResult = await loginViaLocalServer(email, password);
        if (localServerResult.success) return localServerResult;
        
        const cacheResult = await loginViaCache(email, password);
        if (cacheResult.success) return cacheResult;
        
        return {
          success: false,
          isOffline: false,
          error: 'Erro de conexao. Tente novamente.',
        };
      }

      // Erro de credenciais
      if (error.message.includes('Invalid login credentials')) {
        return {
          success: false,
          isOffline: false,
          error: 'E-mail ou senha incorretos',
        };
      }

      // Outro erro - tentar fallback
      console.log('[LoginHandler] Erro Supabase, tentando alternativas...');
      
      const localServerResult = await loginViaLocalServer(email, password);
      if (localServerResult.success) return localServerResult;
      
      const cacheResult = await loginViaCache(email, password);
      if (cacheResult.success) return cacheResult;
      
      return {
        success: false,
        isOffline: false,
        error: 'Erro ao conectar. Tente novamente.',
      };
    }

    // ==============================================
    // LOGIN ONLINE SUCESSO - Salvar no cache
    // ==============================================
    console.log('[LoginHandler] Login Supabase bem-sucedido!');
    
    try {
      const { saveUserToCache } = await import('@/lib/offlineAuth');
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
        
        console.log('[LoginHandler] Usuario salvo no cache para login offline futuro');
      }
    } catch (cacheErr) {
      console.warn('[LoginHandler] Nao foi possivel salvar no cache:', cacheErr);
      // Não bloquear o login por causa disso
    }
    
    return {
      success: true,
      isOffline: false,
    };

  } catch (err: any) {
    // Exceção capturada - provavelmente erro de rede
    console.log('[LoginHandler] Excecao no login:', err.message);
    
    if (isNetworkError(err)) {
      console.log('[LoginHandler] Erro de rede detectado, usando fallback...');
      
      const localServerResult = await loginViaLocalServer(email, password);
      if (localServerResult.success) return localServerResult;
      
      const cacheResult = await loginViaCache(email, password);
      if (cacheResult.success) return cacheResult;
    }
    
    return {
      success: false,
      isOffline: false,
      error: 'Erro ao conectar. Tente novamente.',
    };
  }
}

export default handleLoginWithOffline;
