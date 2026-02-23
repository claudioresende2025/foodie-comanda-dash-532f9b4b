import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Utensils, Loader2, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let resolved = false;

    // Listen for PASSWORD_RECOVERY event (fires when Supabase processes the recovery token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        resolved = true;
        setIsValid(true);
        setChecking(false);
        sessionStorage.removeItem('password_recovery');
      }
    });

    // Also check if we already have a session (e.g. from the redirect)
    const checkSession = async () => {
      // Small delay to let onAuthStateChange fire first
      await new Promise(r => setTimeout(r, 500));
      if (resolved) return;

      const { data: { session } } = await supabase.auth.getSession();
      const hasFlag = sessionStorage.getItem('password_recovery') === 'true';

      if (session && hasFlag) {
        resolved = true;
        setIsValid(true);
        setChecking(false);
        sessionStorage.removeItem('password_recovery');
      } else if (session) {
        // Has session but no recovery flag — might still be valid recovery
        resolved = true;
        setIsValid(true);
        setChecking(false);
      } else {
        // Wait a bit more for the token to be processed
        await new Promise(r => setTimeout(r, 1500));
        if (resolved) return;
        
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession) {
          resolved = true;
          setIsValid(true);
          setChecking(false);
        } else {
          resolved = true;
          setChecking(false);
          toast.error('Link de recuperação inválido ou expirado.');
          navigate('/auth');
        }
      }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não conferem.');
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast.error('Erro ao redefinir senha. Tente novamente.');
    } else {
      toast.success('Senha redefinida com sucesso!');
      navigate('/auth');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-fcd-orange-light p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Verificando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (!isValid) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-fcd-orange-light p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-fcd mb-4">
            <Utensils className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Redefinir Senha
          </h1>
          <p className="text-muted-foreground mt-2">Digite sua nova senha abaixo</p>
        </div>

        <Card className="shadow-fcd border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Nova Senha</CardTitle>
            <CardDescription>
              Escolha uma senha segura com no mínimo 6 caracteres
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
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
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    Salvando...
                  </>
                ) : (
                  'Redefinir Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
