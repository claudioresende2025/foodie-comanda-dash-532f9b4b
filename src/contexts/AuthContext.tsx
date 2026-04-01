import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { baixarDadosIniciais, salvarUsuarioCache } from '@/lib/db';
import { connectionManager } from '@/lib/connectionManager';

interface Profile {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Logout automático após 1 hora de inatividade
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
        
        // CONFIGURAR EMPRESA_ID NO CONNECTION MANAGER (Offline-First)
        if (data.empresa_id) {
          connectionManager.setEmpresaId(data.empresa_id);
        }
        
        // BAIXAR DADOS PARA INDEXEDDB QUANDO TEMOS EMPRESA_ID (Offline-First)
        if (data.empresa_id && navigator.onLine) {
          console.log('📥 Baixando dados para modo offline...');
          baixarDadosIniciais(data.empresa_id).catch(err => {
            console.warn('Erro ao baixar dados iniciais:', err);
          });
        }
        
        // SALVAR USUÁRIO NO CACHE PARA LOGIN OFFLINE FUTURO
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
          
          salvarUsuarioCache({
            email: data.email,
            id: data.id,
            nome: data.nome,
            empresa_id: data.empresa_id,
            role: role
          });
        } catch (cacheErr) {
          console.warn('[AuthContext] Erro ao salvar cache do usuário:', cacheErr);
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
      // Se offline, não impede o uso
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          sessionStorage.setItem('password_recovery', 'true');
          window.location.replace('/reset-password');
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session - controls initial loading
    // Timeout para evitar loading infinito quando offline
    const sessionTimeout = setTimeout(() => {
      console.warn('[AuthContext] Timeout ao verificar sessão - possivelmente offline');
      setLoading(false);
    }, 5000); // 5 segundos de timeout
    
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      
      setLoading(false);
    }).catch((error) => {
      clearTimeout(sessionTimeout);
      console.error('[AuthContext] Erro ao obter sessão (offline?):', error);
      // Se estiver offline, liberar o loading para permitir uso local
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
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
