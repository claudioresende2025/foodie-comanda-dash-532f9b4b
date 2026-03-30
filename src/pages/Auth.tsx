import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Utensils, Loader2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

// Roles que pertencem à equipe (staff)
const STAFF_ROLES = ['proprietario', 'gerente', 'garcom', 'caixa', 'motoboy'];

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'Senha deve ter no mínimo 6 caracteres');
const nomeSchema = z.string().min(2, 'Nome deve ter no mínimo 2 caracteres');

export default function Auth() {
  const { empresaNome } = useParams<{ empresaNome?: string }>();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const hasRedirected = useRef(false);
  
  const { signIn, signUp, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Ler tab da URL e mostrar mensagem de plano selecionado
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'signup') {
      setActiveTab('signup');
    }
    
    // Verificar se tem plano pendente no localStorage e exibir toast (apenas uma vez)
    try {
      const pending = localStorage.getItem('post_subscribe_plan');
      if (pending) {
        const parsed = JSON.parse(pending);
        // Verificar se o plano foi selecionado há menos de 1 hora (timestamp válido)
        const timestamp = parsed?.timestamp || 0;
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        if (timestamp < oneHourAgo) {
          // Plano pendente expirado, limpar
          localStorage.removeItem('post_subscribe_plan');
          sessionStorage.removeItem('plan_toast_shown');
        } else if (parsed?.planoSlug && !sessionStorage.getItem('plan_toast_shown')) {
          const planoNomes: Record<string, string> = {
            'bronze': 'Bronze (Iniciante)',
            'prata': 'Prata (Intermediário)',
            'ouro': 'Ouro (Enterprise)',
          };
          const nomePlano = planoNomes[parsed.planoSlug] || parsed.planoSlug;
          toast.success(`Plano ${nomePlano} selecionado! Complete seu cadastro.`);
          sessionStorage.setItem('plan_toast_shown', '1');
        }
      }
    } catch (e) {
      // ignore - limpar se houver erro ao parsear
      localStorage.removeItem('post_subscribe_plan');
    }
  }, [searchParams]);

// Buscar empresa pelo nome na URL (Híbrido: Nuvem -> Local)
  const { data: empresaUrl } = useQuery({
    queryKey: ['empresa-auth', empresaNome],
    queryFn: async () => {
      if (!empresaNome) return null;
      const decoded = decodeURIComponent(empresaNome);

      // 1. TENTA BUSCAR NO SUPABASE (Online)
      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('id, nome_fantasia, logo_url')
          .ilike('nome_fantasia', decoded)
          .maybeSingle();
        
        if (!error && data) return data;
      } catch (onlineErr) {
        console.warn("⚠️ Supabase inacessível, tentando dados da empresa no servidor local...");
      }

      // 2. SE FALHAR (OFFLINE), BUSCA NO SERVIDOR LOCAL (PC DO CAIXA)
      try {
        const localRes = await fetch(`http://192.168.2.111:3000/api/local/empresa-auth/${encodeURIComponent(decoded)}`);
        if (localRes.ok) {
          return await localRes.json();
        }
      } catch (localErr) {
        console.error("🚨 Servidor local também falhou ao retornar dados da empresa.");
      }

      // 3. FALLBACK FINAL: Se nada funcionar, retorna um objeto básico para não quebrar a tela
      return { id: null, nome_fantasia: "Food Comanda Pro (Offline)" };
    },
    enabled: !!empresaNome,
    retry: false, // Importante: evita que o React fique tentando infinitamente sem rede
  });

  // Função para verificar o role do usuário e redirecionar apropriadamente
  const redirectBasedOnRole = useCallback(async (userId: string, empresaId: string | null) => {
    // Verificar primeiro se é super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, ativo')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle();
    
    // Se for super admin ativo, redireciona para página de super admin
    if (superAdmin?.ativo) {
      navigate('/super-admin');
      return;
    }

    // Buscar todos os roles do usuário (pode ter em várias empresas)
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role, empresa_id')
      .eq('user_id', userId);

    // Se não tem empresa_id E não tem nenhum role, é um cliente de delivery
    if (!empresaId && (!userRoles || userRoles.length === 0)) {
      navigate('/delivery');
      return;
    }

    // Se não tem empresa_id mas tem role em alguma empresa, vai para onboarding
    if (!empresaId) {
      // Se tem role em alguma empresa, redireciona para admin dessa empresa
      if (userRoles && userRoles.length > 0) {
        const firstRole = userRoles[0];
        if (firstRole.role && STAFF_ROLES.includes(firstRole.role)) {
          // Se é motoboy, redireciona para o painel do entregador
          if (firstRole.role === 'motoboy') {
            navigate('/admin/entregador');
            return;
          }
          navigate('/admin');
          return;
        }
      }
      navigate('/admin/onboarding');
      return;
    }

    const userRole = userRoles?.find(r => r.empresa_id === empresaId);
    const role = userRole?.role;

    if (role && STAFF_ROLES.includes(role)) {
      // Se é motoboy, redireciona direto para o painel do entregador
      if (role === 'motoboy') {
        navigate('/admin/entregador');
        return;
      }
      navigate('/admin');
    } else {
      navigate(`/menu/${empresaId}`);
    }
  }, [navigate]);

  // Efeito para redirecionar quando já está logado (apenas uma vez)
  useEffect(() => {
    // Só redireciona se não estiver carregando, tiver usuário autenticado e não tiver redirecionado ainda
    if (!authLoading && user && profile && !hasRedirected.current) {
      hasRedirected.current = true;
      redirectBasedOnRole(user.id, profile.empresa_id);
    }
  }, [user, profile, redirectBasedOnRole, authLoading]);

  const validateLogin = () => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return false;
    }
  };

  const validateSignup = () => {
    try {
      nomeSchema.parse(nome);
      emailSchema.parse(email);
      passwordSchema.parse(password);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;

    // Resetar flag de redirecionamento para permitir que useEffect redirecione após login
    hasRedirected.current = false;

    setIsLoading(true);

    // Helper: tenta login no servidor local com AbortController
    const tryLocalLogin = async (): Promise<boolean> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos
      
      try {
        console.log("🔄 Tentando login no servidor local...");
        const localResponse = await fetch(`http://192.168.2.111:3000/api/local/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (localResponse.ok) {
          const localData = await localResponse.json();
          console.log("✅ Resposta do servidor local:", localData);
          if (localData.success) {
            setIsLoading(false);
            toast.success('Login Offline realizado (Modo de Contingência)');
            navigate('/admin');
            return true;
          } else {
            console.warn("❌ Servidor local retornou success=false");
          }
        } else {
          console.warn("❌ Servidor local retornou status:", localResponse.status);
        }
      } catch (localErr: any) {
        clearTimeout(timeoutId);
        if (localErr.name === 'AbortError') {
          console.error("⏱️ Timeout ao acessar servidor local");
        } else {
          console.error("🚨 Erro ao acessar servidor local:", localErr);
        }
      }
      return false;
    };

    // Verificar conexão antes de tentar Supabase
    const isOnline = navigator.onLine;
    
    // Se está offline, tenta direto o servidor local
    if (!isOnline) {
      console.log("📴 Navegador offline, tentando servidor local...");
      const localSuccess = await tryLocalLogin();
      if (localSuccess) return;
      
      setIsLoading(false);
      toast.error('Sem conexão. Verifique se o servidor local está rodando.');
      return;
    }

    // 1. TENTATIVA DE LOGIN ONLINE (SUPABASE) com timeout de 5 segundos
    try {
      const loginPromise = signIn(email, password);
      const timeoutPromise = new Promise<{ error: { message: string } }>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      const result = await Promise.race([loginPromise, timeoutPromise]);
      const error = result?.error;

      if (error) {
        throw error;
      }

      // LOGIN ONLINE COM SUCESSO
      const { data: { user: loggedUser } } = await supabase.auth.getUser();

      if (loggedUser?.id) {
        // Salvar credencial no servidor local para backup offline
        try {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', loggedUser.id)
            .maybeSingle();
          
          const { data: userRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', loggedUser.id)
            .maybeSingle();
          
          await fetch('http://192.168.2.111:3000/api/local/salvar-credencial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: loggedUser.email,
              user_id: loggedUser.id,
              nome: userProfile?.nome || loggedUser.email,
              role: userRole?.role || 'caixa'
            })
          }).catch(() => console.log('Servidor local não disponível para salvar credencial'));
        } catch (e) {
          console.log('Erro ao salvar credencial local:', e);
        }

        const { data: superAdmin } = await supabase
          .from('super_admins')
          .select('id, ativo')
          .eq('user_id', loggedUser.id)
          .eq('ativo', true)
          .maybeSingle();

        if (superAdmin?.ativo) {
          setIsLoading(false);
          hasRedirected.current = true;
          localStorage.removeItem('post_subscribe_plan');
          sessionStorage.removeItem('plan_toast_shown');
          toast.success('Login realizado com sucesso!');
          navigate('/super-admin');
          return;
        }
      }

      setIsLoading(false);
      localStorage.removeItem('post_subscribe_plan');
      sessionStorage.removeItem('plan_toast_shown');
      toast.success('Login realizado com sucesso!');

    } catch (error: any) {
      // 🔥 FALLBACK OFFLINE: Se falhar online ou timeout, tenta o servidor local
      console.warn("⚠️ Falha no login online, tentando modo local...", error?.message);
      toast.info('Supabase indisponível, tentando servidor local...');

      const localSuccess = await tryLocalLogin();
      if (localSuccess) return;

      setIsLoading(false);
      
      if (error?.message?.includes('Invalid login credentials')) {
        toast.error('E-mail ou senha incorretos');
      } else if (error?.message?.includes('Email not confirmed')) {
        toast.error('Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.');
      } else if (error?.message === 'Timeout') {
        toast.error('Servidores indisponíveis. Verifique se o servidor local (192.168.2.111:3000) está rodando.');
      } else {
        toast.error('Erro ao fazer login. Verifique sua conexão e o servidor local.');
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignup()) return;

    setIsLoading(true);

    const { error } = await signUp(email, password, nome);

    if (error) {
      setIsLoading(false);
      if (error.message.includes('User already registered')) {
        toast.error('Este e-mail já está cadastrado. Tente fazer login.');
      } else {
        toast.error('Erro ao criar conta: ' + error.message);
      }
    } else {
      setIsLoading(false);
      setRegisteredEmail(email);
      setShowEmailConfirmation(true);
      // Limpar campos
      setEmail('');
      setPassword('');
      setNome('');
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast.error('Digite seu e-mail');
      return;
    }
    
    try {
      emailSchema.parse(forgotEmail);
    } catch {
      toast.error('E-mail inválido');
      return;
    }
    
    setIsLoading(true);
    
    // URL de reset fixa para o domínio de produção
    const resetRedirectUrl = 'https://foodcomandapro.servicecoding.com.br/reset-password';
    
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: resetRedirectUrl,
    });
    
    // Também enviar email personalizado via Resend
    if (!error) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'password_reset',
            to: forgotEmail,
            data: {
              resetUrl: resetRedirectUrl,
            },
          },
        });
      } catch (emailError) {
        console.warn('Erro ao enviar email personalizado de recuperação:', emailError);
      }
    }
    
    setIsLoading(false);
    
    if (error) {
      toast.error('Erro ao enviar e-mail de recuperação');
    } else {
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setShowForgotPassword(false);
      setForgotEmail('');
    }
  };

  // Tela de confirmação de email após cadastro
  if (showEmailConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-fcd-orange-light p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Verifique seu e-mail
            </h1>
            <p className="text-muted-foreground">
              Enviamos um link de confirmação para:
            </p>
            <p className="text-primary font-semibold mt-2 text-lg">
              {registeredEmail}
            </p>
          </div>

          <Card className="shadow-fcd border-0">
            <CardContent className="pt-6">
              <div className="space-y-4 text-center">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 text-sm">
                    <strong>📧 Importante:</strong> Clique no link enviado para seu e-mail para confirmar sua conta. Após a confirmação, você será redirecionado para configurar seu restaurante.
                  </p>
                </div>
                
                <p className="text-muted-foreground text-sm">
                  Não recebeu o e-mail? Verifique sua pasta de spam ou lixo eletrônico.
                </p>

                <div className="pt-4 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowEmailConfirmation(false);
                      setActiveTab('login');
                    }}
                  >
                    Voltar para Login
                  </Button>
                  
                  <p className="text-xs text-muted-foreground">
                    Após confirmar seu e-mail, faça login para continuar.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-fcd-orange-light p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          {empresaUrl?.logo_url ? (
            <img 
              src={empresaUrl.logo_url} 
              alt={empresaUrl.nome_fantasia} 
              className="w-20 h-20 rounded-2xl shadow-fcd mb-4 mx-auto object-cover"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-fcd mb-4">
              <Utensils className="w-8 h-8 text-primary-foreground" />
            </div>
          )}
          <h1 className="text-3xl font-bold text-foreground">
            {empresaUrl?.nome_fantasia || (<>Food <span className="text-accent">Comanda</span> Pro</>)}
          </h1>
          <p className="text-muted-foreground mt-2">
            {empresaUrl ? 'Acesse sua conta' : 'Sistema Digital de Comandas'}
          </p>
        </div>

        <Card className="shadow-fcd border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Bem-vindo!</CardTitle>
            <CardDescription>
              Acesse sua conta ou crie uma nova para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-sm text-primary hover:underline mt-2"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotPassword(true);
                    }}
                  >
                    Esqueci minha senha
                  </button>
                </form>
                
                {/* Dialog Esqueci minha senha */}
                <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Recuperar Senha</DialogTitle>
                      <DialogDescription>
                        Digite seu e-mail para receber o link de recuperação
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">E-mail</Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => setShowForgotPassword(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          className="flex-1 bg-primary hover:bg-primary/90"
                          onClick={handleForgotPassword}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Enviar'
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-nome">Nome Completo</Label>
                    <Input
                      id="signup-nome"
                      type="text"
                      placeholder="Seu nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-accent hover:bg-accent/90"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      'Criar Conta'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        {/* Link para clientes */}
        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
            onClick={() => navigate('/auth/cliente')}
          >
            É cliente? <span className="underline">Faça seus pedidos aqui</span>
          </button>
        </div>
      </div>
    </div>
  );
}
