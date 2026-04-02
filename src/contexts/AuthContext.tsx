import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { connectionManager } from '@/lib/connectionManager';

interface Profile {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
  avatar_url: string | null;
}

// Permissões do usuário (carregadas do cache offline ou da nuvem)
interface UserPermissions {
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

// Email do Super Admin — opera 100% online, sem Dexie/offline
const SUPER_ADMIN_EMAIL = 'claudinhoresendemoura@gmail.com';

// Chaves de localStorage para persistência
const STORAGE_KEYS = {
  OFFLINE_USER: 'offline_user',
  OFFLINE_SESSION: 'offline_session',
  EMPRESA_DATA: 'empresa_data',
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  permissions: UserPermissions | null;
  isOfflineSession: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Permissões padrão (acesso total para compatibilidade)
const defaultPermissions: UserPermissions = {
  canViewFaturamento: true,
  canViewRelatorios: true,
  canManageTeam: true,
  canManageProdutos: true,
  canManageMesas: true,
  canOperateCaixa: true,
  canTakeOrders: true,
  canDelivery: false,
  canAccessAdmin: true,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Variável para armazenar a senha temporariamente durante o login
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);

  // Logout automático após 1 hora de inatividade
  useInactivityTimeout(!!user);

  // ==================== PERSISTÊNCIA LOCAL ====================
  
  /**
   * Salva dados do usuário e empresa no localStorage
   * Garante que o App sabe "quem" está logado mesmo offline
   */
  const persistUserLocally = (userData: { id: string; email: string; nome: string; empresa_id: string | null; role?: string; permissions?: UserPermissions }) => {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_USER, JSON.stringify(userData));
      console.log('[AuthContext] 💾 Usuário persistido localmente');
    } catch (e) {
      console.warn('[AuthContext] Erro ao persistir usuário:', e);
    }
  };
  
  /**
   * Recupera dados do usuário do localStorage
   */
  const getPersistedUser = (): { id: string; email: string; nome: string; empresa_id: string | null; role?: string; permissions?: UserPermissions } | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setProfile(data);
        
        // Detectar Super Admin pelo email
        const isSA = data.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
        setIsSuperAdmin(isSA);
        
        // Super Admin opera 100% online — NUNCA baixar Dexie/offline
        if (isSA) {
          console.log('[AuthContext] 🛡️ Super Admin detectado — modo 100% online');
          setPermissions(defaultPermissions);
          return;
        }
        
        // CONFIGURAR EMPRESA_ID NO CONNECTION MANAGER (Offline-First)
        if (data.empresa_id) {
          connectionManager.setEmpresaId(data.empresa_id);
        }
        
        // BAIXAR DADOS PARA INDEXEDDB QUANDO TEMOS EMPRESA_ID (Offline-First)
        if (data.empresa_id && navigator.onLine) {
          console.log('📥 Baixando dados para modo offline...');
          import('@/lib/db').then(({ baixarDadosIniciais }) => {
            baixarDadosIniciais(data.empresa_id).catch(err => {
              console.warn('Erro ao baixar dados iniciais:', err);
            });
          }).catch(err => {
            console.warn('Erro ao importar db:', err);
          });
        }
        
        // SALVAR USUÁRIO NO CACHE COM HASH SEGURO PARA LOGIN OFFLINE FUTURO
        try {
          // Buscar role do usuário
          let role = 'proprietario';
          if (data.empresa_id) {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', userId)
              .eq('empresa_id', data.empresa_id)
              .single();
            if (roleData?.role) {
              role = roleData.role;
            }
          }
          
          // Usar o novo sistema de cache seguro com hash
          if (pendingPassword) {
            const { saveUserToCache, getPermissionsByRole, updateLastOnlineAt } = await import('@/lib/offlineAuth');
            
            // Salvar com hash da senha
            await saveUserToCache({
              email: data.email,
              id: data.id,
              nome: data.nome,
              empresa_id: data.empresa_id,
              role: role,
              password: pendingPassword // Será hasheado, não armazenado em texto
            });
            
            // Definir permissões
            const userPermissions = getPermissionsByRole(role);
            setPermissions(userPermissions);
            
            // Limpar senha pendente
            setPendingPassword(null);
          } else {
            // Apenas atualizar timestamp de última conexão
            const { updateLastOnlineAt, getPermissionsByRole } = await import('@/lib/offlineAuth');
            await updateLastOnlineAt(data.email);
            
            // Definir permissões
            const userPermissions = getPermissionsByRole(role);
            setPermissions(userPermissions);
          }
        } catch (cacheErr) {
          console.warn('[AuthContext] Erro ao salvar cache do usuário:', cacheErr);
          // Fallback para permissões padrão
          setPermissions(defaultPermissions);
        }
        
        // Aplicar associação pendente (ex: usuário veio via e-mail pós-checkout)
        try {
          if (!data.empresa_id && typeof window !== 'undefined') {
            const pending = localStorage.getItem('post_subscribe_plan');
            if (pending) {
              const parsed = JSON.parse(pending);
              if (parsed?.empresaId) {
                await supabase.from('profiles').update({ empresa_id: parsed.empresaId }).eq('id', userId);
                // tentar criar user_role como proprietario se não existir
                try {
                  await supabase.from('user_roles').upsert({ user_id: userId, empresa_id: parsed.empresaId, role: 'proprietario' as const }, { onConflict: 'user_id,empresa_id' });
                } catch (e) {
                  console.warn('Não foi possível criar user_role automaticamente', e);
                }
                localStorage.removeItem('post_subscribe_plan');
                // atualizar profile localmente
                const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', userId).single();
                if (refreshed) setProfile(refreshed as Profile);
              }
            }
          }
        } catch (e) {
          console.warn('Erro ao aplicar associação pendente:', e);
        }
      }
    } catch (error) {
      console.warn('[AuthContext] Erro ao buscar perfil (offline?):', error);
      
      // Se offline, tentar usar dados persistidos localmente
      const persistedUser = getPersistedUser();
      if (persistedUser && persistedUser.empresa_id) {
        console.log('[AuthContext] 📴 Offline - usando dados persistidos');
        setProfile({
          id: persistedUser.id,
          nome: persistedUser.nome,
          email: persistedUser.email,
          empresa_id: persistedUser.empresa_id,
          avatar_url: null,
        });
        if (persistedUser.permissions) {
          setPermissions(persistedUser.permissions);
        } else {
          setPermissions(defaultPermissions);
        }
        setIsOfflineSession(true);
        return;
      }
      
      // Se não tem dados locais, permissões padrão
      setPermissions(defaultPermissions);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Log de diagnóstico inicial
    console.log('[AuthContext] 🚀 Inicializando AuthProvider...');
    console.log('[AuthContext] 📍 navigator.onLine:', navigator.onLine);
    
    // ============================================
    // OFFLINE PRIORITÁRIO: Se offline, restaurar sessão local ANTES de tudo
    // ============================================
    if (!navigator.onLine) {
      console.log('[AuthContext] 📴 OFFLINE - Verificando sessão local ANTES de Supabase');
      const persistedUser = getPersistedUser();
      
      if (persistedUser) {
        console.log('[AuthContext] ✅ Usuário encontrado no localStorage:', persistedUser.email);
        setUser({ id: persistedUser.id, email: persistedUser.email } as User);
        setProfile({
          id: persistedUser.id,
          nome: persistedUser.nome,
          email: persistedUser.email,
          empresa_id: persistedUser.empresa_id,
          avatar_url: null,
        });
        setPermissions(persistedUser.permissions || defaultPermissions);
        setIsOfflineSession(true);
        setLoading(false);
        return; // NÃO tentar Supabase
      }
      
      // Tentar sessão offline do Dexie
      import('@/lib/offlineAuth').then(({ getOfflineSession }) => {
        const offlineSession = getOfflineSession();
        if (offlineSession) {
          console.log('[AuthContext] ✅ Sessão offline Dexie encontrada');
          setUser({ id: offlineSession.user.id, email: offlineSession.user.email } as User);
          setProfile({
            id: offlineSession.user.id,
            nome: offlineSession.user.nome,
            email: offlineSession.user.email,
            empresa_id: offlineSession.user.empresa_id,
            avatar_url: null,
          });
          setPermissions(offlineSession.user.permissions);
          setIsOfflineSession(true);
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
      
      return; // NÃO configurar listener Supabase quando offline
    }
    
    // ============================================
    // ONLINE: Set up auth state listener
    // ============================================
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthContext] 📡 onAuthStateChange:', event, session?.user?.email);
        
        if (event === 'PASSWORD_RECOVERY') {
          sessionStorage.setItem('password_recovery', 'true');
          window.location.replace('/reset-password');
          return;
        }
        
        // ============================================
        // CURTO-CIRCUITO: Se Super Admin, configurar estado sem redirect loop
        // ============================================
        const userEmail = session?.user?.email?.toLowerCase();
        console.log('[AuthContext] 🔍 Perfil Detectado:', userEmail);
        
        if (userEmail === SUPER_ADMIN_EMAIL) {
          console.log('[AuthContext] 🛡️ SUPER ADMIN detectado via onAuthStateChange');
          sessionStorage.setItem('isSuperAdmin', 'true');
          setIsSuperAdmin(true);
          setUser(session?.user ?? null);
          setSession(session);
          setProfile({ id: session!.user.id, nome: 'Super Admin', email: userEmail, empresa_id: null, avatar_url: null });
          setPermissions(defaultPermissions);
          setLoading(false);
          
          // Redirecionar APENAS se for SIGNED_IN e NÃO estiver já em /super-admin
          if (event === 'SIGNED_IN' && !window.location.pathname.startsWith('/super-admin')) {
            console.log('[AuthContext] 🚀 Redirecionando Super Admin para /super-admin');
            window.location.href = '/super-admin';
          }
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setPermissions(null);
        }
      }
    );

    // Função para tentar restaurar sessão offline
    const tryRestoreOfflineSession = async () => {
      try {
        const { getOfflineSession } = await import('@/lib/offlineAuth');
        const offlineSession = getOfflineSession();
        
        if (offlineSession) {
          console.log('[AuthContext] Restaurando sessão offline...');
          setIsOfflineSession(true);
          setUser({ id: offlineSession.user.id, email: offlineSession.user.email } as User);
          setProfile({
            id: offlineSession.user.id,
            nome: offlineSession.user.nome,
            email: offlineSession.user.email,
            empresa_id: offlineSession.user.empresa_id,
            avatar_url: null,
          });
          setPermissions(offlineSession.user.permissions);
          return true;
        }
      } catch (e) {
        console.warn('[AuthContext] Erro ao restaurar sessão offline:', e);
      }
      return false;
    };

    // THEN check for existing session - controls initial loading
    // Race: quem resolver primeiro (getSession vs offline restore) libera a UI
    const sessionTimeout = setTimeout(async () => {
      console.warn('[AuthContext] Timeout ao verificar sessão - possivelmente offline');
      await tryRestoreOfflineSession();
      setLoading(false);
    }, 1500); // 1.5s — suficiente para conexão boa, fallback rápido offline
    
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      
      // ============================================
      // CURTO-CIRCUITO SUPER ADMIN no getSession
      // ============================================
      const userEmail = session?.user?.email?.toLowerCase();
      if (userEmail === SUPER_ADMIN_EMAIL) {
        console.log('[AuthContext] 🛡️ Super Admin detectado via getSession — configurando estado');
        sessionStorage.setItem('isSuperAdmin', 'true');
        setIsSuperAdmin(true);
        setSession(session);
        setUser(session?.user ?? null);
        setProfile({ id: session!.user.id, nome: 'Super Admin', email: userEmail, empresa_id: null, avatar_url: null });
        setPermissions(defaultPermissions);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        // Sem sessão online, tentar offline
        await tryRestoreOfflineSession();
      }
      
      setLoading(false);
    }).catch(async (error) => {
      clearTimeout(sessionTimeout);
      console.error('[AuthContext] Erro ao obter sessão (offline?):', error);
      
      // Tentar restaurar sessão offline
      await tryRestoreOfflineSession();
      
      // Se estiver offline, liberar o loading para permitir uso local
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] 🔐 signIn chamado para:', email);
    console.log('[AuthContext] 📍 navigator.onLine:', navigator.onLine);
    
    // ============================================
    // OFFLINE PRIORITÁRIO: Se offline, usar loginHandler DIRETO
    // PROIBIDO chamar supabase.auth quando offline
    // ============================================
    if (!navigator.onLine) {
      console.log('[AuthContext] 📴 OFFLINE - Usando loginHandler (Supabase BLOQUEADO)');
      
      // Super Admin requer internet
      if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
        return { error: new Error('Super Admin requer conexão com internet.') };
      }
      
      try {
        const { handleLoginWithOffline } = await import('@/lib/loginHandler');
        const result = await handleLoginWithOffline(email, password, async () => ({ error: new Error('Offline') }));
        
        if (result.success && result.user) {
          console.log('[AuthContext] ✅ Login offline bem-sucedido');
          
          // Configurar estado da aplicação
          setIsOfflineSession(true);
          setUser({ id: result.user.id, email: result.user.email } as User);
          setProfile({
            id: result.user.id,
            nome: result.user.nome,
            email: result.user.email,
            empresa_id: result.user.empresa_id,
            avatar_url: null,
          });
          setPermissions(result.user.permissions || defaultPermissions);
          
          // Persistir localmente
          persistUserLocally(result.user);
          
          // Redirecionar para admin
          if (result.redirectTo) {
            window.location.href = result.redirectTo;
          }
          
          return { error: null };
        }
        
        return { error: new Error(result.error || 'Falha no login offline') };
      } catch (err: any) {
        console.error('[AuthContext] ❌ Erro no login offline:', err);
        return { error: new Error(err.message || 'Erro no login offline') };
      }
    }
    
    // ============================================
    // ONLINE: Fluxo normal com Supabase
    // ============================================
    
    // Armazenar senha temporariamente para criar hash no cache
    setPendingPassword(password);
    setIsOfflineSession(false);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Se houver erro, limpar a senha pendente
    if (error) {
      setPendingPassword(null);
      
      // Se erro de rede, tentar fallback offline
      const errMsg = (error.message || '').toLowerCase();
      if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('failed')) {
        console.log('[AuthContext] ⚠️ Erro de rede, tentando fallback offline...');
        try {
          const { handleLoginWithOffline } = await import('@/lib/loginHandler');
          const result = await handleLoginWithOffline(email, password, async () => ({ error }));
          
          if (result.success && result.user) {
            setIsOfflineSession(true);
            setUser({ id: result.user.id, email: result.user.email } as User);
            setProfile({
              id: result.user.id,
              nome: result.user.nome,
              email: result.user.email,
              empresa_id: result.user.empresa_id,
              avatar_url: null,
            });
            setPermissions(result.user.permissions || defaultPermissions);
            persistUserLocally(result.user);
            
            if (result.redirectTo) {
              window.location.href = result.redirectTo;
            }
            return { error: null };
          }
        } catch {}
      }
      
      return { error: error as Error | null };
    }
    
    // ============================================
    // CURTO-CIRCUITO SUPER ADMIN — ANTES DE TUDO
    // Redireciona IMEDIATAMENTE sem carregar Dexie/offline
    // ============================================
    const userEmail = data?.user?.email?.toLowerCase();
    console.log('[AuthContext] 🔍 Perfil Detectado após signIn:', userEmail);
    
    if (userEmail === SUPER_ADMIN_EMAIL) {
      console.log('[AuthContext] 🚀 SUPER ADMIN DETECTADO — Redirecionando IMEDIATAMENTE para /super-admin');
      // Marcar no sessionStorage para o SW e App saberem
      sessionStorage.setItem('isSuperAdmin', 'true');
      // Redirecionar ANTES de qualquer inicialização de Dexie/sync
      window.location.href = '/super-admin';
      return { error: null };
    }
    
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    // Redirecionar para /auth após confirmação - o usuário fará login novamente
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome,
        },
      },
    });

    // Se o registro foi bem-sucedido, enviar email de boas-vindas personalizado via Resend
    // O email de confirmação com o link é enviado pelo Supabase automaticamente
    if (!error && data?.user) {
      try {
        const emailPayload = {
          type: 'account_confirmation',
          to: email,
          data: {
            nome,
            confirmUrl: redirectUrl,
          },
        };
        console.log('[AuthContext] Enviando email:', emailPayload);
        
        const { data: responseData, error: invokeError } = await supabase.functions.invoke('send-email', {
          body: emailPayload,
        });
        
        if (invokeError) {
          console.warn('[AuthContext] Erro ao invocar send-email:', invokeError);
        } else {
          console.log('[AuthContext] Email enviado com sucesso:', responseData);
        }
      } catch (emailError) {
        console.warn('Erro ao enviar email de boas-vindas personalizado:', emailError);
        // Não retornar erro aqui, pois o cadastro foi feito com sucesso
      }
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Limpar estados PRIMEIRO (redirecionamento imediato)
    setUser(null);
    setSession(null);
    setProfile(null);
    setPermissions(null);
    setIsOfflineSession(false);

    // Limpar sessão offline
    try {
      const { clearOfflineSession } = await import('@/lib/offlineAuth');
      clearOfflineSession();
    } catch (e) {
      console.warn('[AuthContext] Erro ao limpar sessão offline:', e);
    }

    // Limpar sessão do Supabase apenas se online (evita bloqueio)
    if (navigator.onLine) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[AuthContext] Erro ao deslogar do Supabase (offline):', e);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      permissions, 
      isOfflineSession,
      isSuperAdmin,
      signIn, 
      signUp, 
      signOut, 
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
