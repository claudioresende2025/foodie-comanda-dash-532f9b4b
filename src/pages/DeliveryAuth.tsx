import { useState, useEffect, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Lock, User, ArrowLeft, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'Mínimo 6 caracteres');
const nameSchema = z.string().min(2, 'Mínimo 2 caracteres');

// Componente de loading otimizado para PWA
const PWALoadingScreen = memo(function PWALoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary">
      <div className="animate-pulse mb-6">
        <img 
          src="/pwa-icon-192.png" 
          alt="Food Comanda Pro" 
          className="w-24 h-24 rounded-3xl shadow-2xl"
          loading="eager"
        />
      </div>
      <h1 className="text-xl font-bold text-primary-foreground mb-2">Food Comanda Pro</h1>
      <p className="text-primary-foreground/70 text-sm mb-6">Carregando...</p>
      <Loader2 className="w-6 h-6 animate-spin text-primary-foreground/80" />
    </div>
  );
});

// Componente do formulário de login memoizado
const LoginForm = memo(function LoginForm({ 
  email, 
  setEmail, 
  password, 
  setPassword, 
  isLoading, 
  onSubmit 
}: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base"
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="login-password">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base"
            required
          />
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full h-12 text-lg font-semibold rounded-xl touch-manipulation"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : null}
        Entrar
      </Button>
    </form>
  );
});

// Componente do formulário de cadastro memoizado
const SignupForm = memo(function SignupForm({ 
  nome,
  setNome,
  email, 
  setEmail, 
  password, 
  setPassword, 
  isLoading, 
  onSubmit 
}: {
  nome: string;
  setNome: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-nome">Nome Completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            id="signup-nome"
            type="text"
            autoComplete="name"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base"
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base"
            required
          />
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full h-12 text-lg font-semibold rounded-xl touch-manipulation"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : null}
        Criar Conta
      </Button>
    </form>
  );
});

export default function DeliveryAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Verificar se já está logado
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const redirectTo = location.state?.from || '/delivery';
        navigate(redirectTo, { replace: true });
      }
      setCheckingAuth(false);
    };
    checkSession();
  }, [navigate, location.state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      return toast.error('Sem conexão com a internet');
    }
    
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err: any) {
      return toast.error(err.errors?.[0]?.message || 'Dados inválidos');
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      toast.success('Login realizado!');
      const redirectTo = location.state?.from || '/delivery';
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      if (err.message?.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else {
        toast.error(err.message || 'Erro ao fazer login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isOnline) {
      return toast.error('Sem conexão com a internet');
    }
    
    try {
      nameSchema.parse(nome);
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err: any) {
      return toast.error(err.errors?.[0]?.message || 'Dados inválidos');
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/delivery`,
          data: { nome }
        }
      });
      if (error) throw error;
      
      toast.success('Cadastro realizado com sucesso!');
      const redirectTo = location.state?.from || '/delivery';
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        toast.error('Este email já está cadastrado');
      } else {
        toast.error(err.message || 'Erro ao cadastrar');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingAuth) {
    return <PWALoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex flex-col safe-area-inset-top safe-area-inset-bottom">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-destructive text-destructive-foreground text-center py-2 text-sm font-medium">
          Sem conexão com a internet
        </div>
      )}

      {/* Header otimizado para PWA */}
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-50">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-primary-foreground hover:bg-primary-foreground/10 touch-manipulation"
            onClick={() => navigate('/delivery')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img 
              src="/pwa-icon.png" 
              alt="Food Comanda Pro" 
              className="w-8 h-8 rounded-lg"
              loading="eager"
            />
            <h1 className="text-lg font-bold">Entrar ou Cadastrar</h1>
          </div>
        </div>
      </header>

      {/* Content com padding otimizado para mobile */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:py-8">
        <Card className="w-full max-w-md shadow-xl border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-3 pb-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Food Comanda Pro</CardTitle>
            <CardDescription className="text-base">
              Faça login para acompanhar seus pedidos e salvar seus endereços
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pb-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
              <TabsList className="grid grid-cols-2 mb-6 h-12">
                <TabsTrigger value="login" className="text-base h-10">Entrar</TabsTrigger>
                <TabsTrigger value="signup" className="text-base h-10">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <LoginForm
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  isLoading={isLoading}
                  onSubmit={handleLogin}
                />
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <SignupForm
                  nome={nome}
                  setNome={setNome}
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  isLoading={isLoading}
                  onSubmit={handleSignup}
                />
              </TabsContent>
            </Tabs>

            {/* Dica PWA */}
            <div className="mt-6 p-3 bg-muted/50 rounded-xl text-center">
              <p className="text-xs text-muted-foreground">
                💡 Instale o app para acesso rápido: Menu do navegador → Adicionar à tela inicial
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
