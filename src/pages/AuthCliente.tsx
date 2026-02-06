import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { User, Loader2, ArrowLeft, Mail, Lock } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'Senha deve ter no mínimo 6 caracteres');
const nomeSchema = z.string().min(2, 'Nome deve ter no mínimo 2 caracteres');

export default function AuthCliente() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [empresaInfo, setEmpresaInfo] = useState<{ id: string; nome: string } | null>(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const empresaId = searchParams.get('empresa');

  // Buscar informações da empresa se passou na URL
  useEffect(() => {
    if (empresaId) {
      const fetchEmpresa = async () => {
        const { data } = await supabase
          .from('empresas')
          .select('id, nome_fantasia')
          .eq('id', empresaId)
          .single();
        
        if (data) {
          setEmpresaInfo({ id: data.id, nome: data.nome_fantasia });
        }
      };
      fetchEmpresa();
    }
  }, [empresaId]);

  // Verificar se já está logado
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Redirecionar para o cardápio da empresa ou delivery
        if (empresaId) {
          navigate(`/menu/${empresaId}`);
        } else {
          navigate('/delivery');
        }
      }
    };
    checkSession();
  }, [navigate, empresaId]);

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
    
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('E-mail ou senha incorretos');
      } else {
        toast.error('Erro ao fazer login. Tente novamente.');
      }
    } else {
      toast.success('Login realizado com sucesso!');
      // Redirecionar para o cardápio da empresa ou delivery
      if (empresaId) {
        navigate(`/menu/${empresaId}`);
      } else {
        navigate('/delivery');
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignup()) return;

    setIsLoading(true);
    
    try {
      // Criar usuário
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome,
          },
        },
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('Erro ao criar usuário');

      // Se tem empresa, vincular o cliente à empresa
      if (empresaId) {
        // Atualizar profile com empresa_id
        await supabase
          .from('profiles')
          .update({ empresa_id: empresaId })
          .eq('id', userId);

        // Criar role como 'client' - NOTA: Se o enum não suportar 'client', deixar sem role
        // O sistema já trata usuários sem role como clientes
      }

      toast.success('Conta criada com sucesso!');
      
      // Redirecionar para o cardápio da empresa ou delivery
      if (empresaId) {
        navigate(`/menu/${empresaId}`);
      } else {
        navigate('/delivery');
      }
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        toast.error('Este e-mail já está cadastrado');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg mb-4">
            <User className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">
            {empresaInfo ? `Cliente - ${empresaInfo.nome}` : 'Fazer Pedido'}
          </h1>
          <p className="text-white/80 text-sm mt-2">
            {empresaInfo 
              ? 'Entre ou cadastre-se para fazer pedidos'
              : 'Acesse sua conta de cliente'
            }
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-center">Área do Cliente</CardTitle>
            <CardDescription className="text-center">
              {empresaInfo 
                ? `Faça pedidos em ${empresaInfo.nome}`
                : 'Faça pedidos nos melhores restaurantes'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-orange-500 hover:bg-orange-600" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-nome">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="signup-nome"
                        type="text"
                        placeholder="Seu nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-orange-500 hover:bg-orange-600" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

        {/* Voltar */}
        <div className="mt-6 text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate(empresaId ? `/menu/${empresaId}` : '/delivery')}
            className="text-white hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {empresaId ? 'Voltar ao Cardápio' : 'Ver Restaurantes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
