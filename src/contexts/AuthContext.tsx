import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';

interface Profile {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
  avatar_url: string | null;
}

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

const SUPER_ADMIN_EMAIL = 'claudinhoresendemoura@gmail.com';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  permissions: UserPermissions | null;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

const getPermissionsByRole = (role: string): UserPermissions => {
  switch (role) {
    case 'proprietario':
    case 'gerente':
      return defaultPermissions;
    case 'garcom':
      return {
        ...defaultPermissions,
        canViewFaturamento: false,
        canViewRelatorios: false,
        canManageTeam: false,
        canManageProdutos: false,
      };
    case 'caixa':
      return {
        ...defaultPermissions,
        canViewFaturamento: false,
        canManageTeam: false,
        canManageProdutos: false,
        canManageMesas: false,
      };
    case 'motoboy':
      return {
        ...defaultPermissions,
        canViewFaturamento: false,
        canViewRelatorios: false,
        canManageTeam: false,
        canManageProdutos: false,
        canManageMesas: false,
        canOperateCaixa: false,
        canTakeOrders: false,
        canDelivery: true,
      };
    default:
      return defaultPermissions;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useInactivityTimeout(!!user);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setProfile(data);
        
        const isSA = data.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
        setIsSuperAdmin(isSA);
        
        if (isSA) {
          setPermissions(defaultPermissions);
          return;
        }
        
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
        
        const userPermissions = getPermissionsByRole(role);
        setPermissions(userPermissions);
        
        // Aplicar associação pendente
        if (!data.empresa_id && typeof window !== 'undefined') {
          const pending = localStorage.getItem('post_subscribe_plan');
          if (pending) {
            const parsed = JSON.parse(pending);
            if (parsed?.empresaId) {
              await supabase.from('profiles').update({ empresa_id: parsed.empresaId }).eq('id', userId);
              try {
                await supabase.from('user_roles').upsert(
                  { user_id: userId, empresa_id: parsed.empresaId, role: 'proprietario' as const },
                  { onConflict: 'user_id,empresa_id' }
                );
              } catch (e) {
                console.warn('Não foi possível criar user_role automaticamente', e);
              }
              localStorage.removeItem('post_subscribe_plan');
              const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', userId).single();
              if (refreshed) setProfile(refreshed as Profile);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[AuthContext] Erro ao buscar perfil:', error);
      setPermissions(defaultPermissions);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          sessionStorage.setItem('password_recovery', 'true');
          window.location.replace('/reset-password');
          return;
        }
        
        const userEmail = session?.user?.email?.toLowerCase();
        
        if (userEmail === SUPER_ADMIN_EMAIL) {
          sessionStorage.setItem('isSuperAdmin', 'true');
          setIsSuperAdmin(true);
          setUser(session?.user ?? null);
          setSession(session);
          setProfile({ id: session!.user.id, nome: 'Super Admin', email: userEmail, empresa_id: null, avatar_url: null });
          setPermissions(defaultPermissions);
          setLoading(false);
          
          if (event === 'SIGNED_IN' && !window.location.pathname.startsWith('/super-admin')) {
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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const userEmail = session?.user?.email?.toLowerCase();
      
      if (userEmail === SUPER_ADMIN_EMAIL) {
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
      }
      
      setLoading(false);
    }).catch((error) => {
      console.error('[AuthContext] Erro ao obter sessão:', error);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      const userEmail = data?.user?.email?.toLowerCase();
      
      if (userEmail === SUPER_ADMIN_EMAIL) {
        sessionStorage.setItem('isSuperAdmin', 'true');
        window.location.href = '/super-admin';
        return { error: null };
      }
    }
    
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { nome },
      },
    });

    if (!error && data?.user) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'account_confirmation',
            to: email,
            data: { nome, confirmUrl: redirectUrl },
          },
        });
      } catch (emailError) {
        console.warn('Erro ao enviar email de boas-vindas:', emailError);
      }
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setPermissions(null);

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthContext] Erro ao deslogar:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      permissions, 
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
