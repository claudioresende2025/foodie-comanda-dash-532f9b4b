import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { 
  Loader2, MapPin, Lock, LogOut, ChevronRight, 
  Trash2, Plus, ArrowLeft 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { BottomNavigation } from '@/components/delivery/BottomNavigation';
import { toast } from 'sonner';
import { z } from 'zod';

interface Address {
  id: string;
  nome_cliente: string;
  telefone: string;
  cep: string | null;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  referencia: string | null;
}

const passwordSchema = z.string().min(6, 'Mínimo 6 caracteres');

export default function DeliveryProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  
  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Password recovery state
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [sendingRecovery, setSendingRecovery] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/delivery/auth', { state: { from: '/delivery/profile' } });
        return;
      }
      setUser(session.user);
      setRecoveryEmail(session.user.email || '');
      setLoading(false);
      fetchAddresses(session.user.id);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        navigate('/delivery/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchAddresses = async (userId: string) => {
    setLoadingAddresses(true);
    try {
      const { data, error } = await supabase
        .from('enderecos_cliente')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Você saiu da conta');
    navigate('/delivery');
  };

  const handleChangePassword = async () => {
    try {
      passwordSchema.parse(newPassword);
      if (newPassword !== confirmPassword) {
        return toast.error('As senhas não coincidem');
      }
    } catch (err: any) {
      return toast.error(err.errors?.[0]?.message || 'Senha inválida');
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success('Senha alterada com sucesso!');
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSendRecovery = async () => {
    if (!recoveryEmail) {
      return toast.error('Digite um email');
    }

    setSendingRecovery(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: `${window.location.origin}/delivery/profile`
      });
      if (error) throw error;
      
      toast.success('Email de recuperação enviado!');
      setRecoveryDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar email');
    } finally {
      setSendingRecovery(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const { error } = await supabase
        .from('enderecos_cliente')
        .delete()
        .eq('id', addressId);

      if (error) throw error;
      
      setAddresses(prev => prev.filter(a => a.id !== addressId));
      toast.success('Endereço removido');
    } catch (err: any) {
      toast.error('Erro ao remover endereço');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate('/delivery')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Meu Perfil</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* User Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conta</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Change Password */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
              <DialogTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                    <span>Alterar senha</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alterar Senha</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleChangePassword} disabled={changingPassword}>
                    {changingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Password Recovery */}
            <Dialog open={recoveryDialogOpen} onOpenChange={setRecoveryDialogOpen}>
              <DialogTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                    <span>Recuperar senha por email</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Recuperar Senha</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="recovery-email">Email</Label>
                    <Input
                      id="recovery-email"
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enviaremos um link para redefinir sua senha.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={handleSendRecovery} disabled={sendingRecovery}>
                    {sendingRecovery && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enviar email
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Logout */}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5" />
                <span>Sair da conta</span>
              </div>
            </button>
          </CardContent>
        </Card>

        {/* Saved Addresses */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Endereços Salvos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAddresses ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum endereço salvo</p>
                <p className="text-xs mt-1">Seus endereços aparecerão aqui após fazer um pedido</p>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <div 
                    key={address.id}
                    className="p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{address.nome_cliente}</p>
                        <p className="text-sm text-muted-foreground">
                          {address.rua}, {address.numero}
                          {address.complemento && ` - ${address.complemento}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {address.bairro} - {address.cidade}/{address.estado}
                        </p>
                        {address.cep && (
                          <p className="text-xs text-muted-foreground">CEP: {address.cep}</p>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover endereço?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteAddress(address.id)}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  );
}
