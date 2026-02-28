import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import AuthCliente from "@/pages/AuthCliente";
import NotFound from "@/pages/NotFound";
import Menu from "@/pages/Menu";
import Delivery from "@/pages/Delivery";
import DeliveryRestaurant from "@/pages/DeliveryRestaurant";
import DeliverySuccess from "@/pages/DeliverySuccess";
import DeliveryTracking from "@/pages/DeliveryTracking";
import DeliveryAuth from "@/pages/DeliveryAuth";
import DeliveryOrders from "@/pages/DeliveryOrders";
import DeliveryProfile from "@/pages/DeliveryProfile";
import Install from "@/pages/Install";
import Index from "@/pages/Index";
import LandingRestaurantes from "@/pages/LandingRestaurantes";
import Planos from "@/pages/Planos";
import SuperAdmin from "@/pages/SuperAdmin";
import SubscriptionSuccess from "@/pages/subscription/Success";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import Dashboard from "@/pages/admin/Dashboard";
import Onboarding from "@/pages/admin/Onboarding";
import Mesas from "@/pages/admin/Mesas";
import Cardapio from "@/pages/admin/Cardapio";
import Pedidos from "@/pages/admin/Pedidos";
import Caixa from "@/pages/admin/Caixa";
import Equipe from "@/pages/admin/Equipe";
import Empresa from "@/pages/admin/Empresa";
import Configuracoes from "@/pages/admin/Configuracoes";
import Garcom from "@/pages/admin/Garcom";
import PedidosDelivery from "@/pages/admin/PedidosDelivery";
import DeliveryDashboard from "@/pages/admin/DeliveryDashboard";
import EntregadorPanel from "@/pages/admin/EntregadorPanel";
import Marketing from "@/pages/admin/Marketing";
import Assinatura from "@/pages/admin/Assinatura";
import DiagnosticoStripe from "@/pages/admin/DiagnosticoStripe";
import usePWAManifest from "@/hooks/usePWAManifest";
import { UpdateNotification } from "@/components/UpdateNotification";
import ErrorBoundary from '@/components/ErrorBoundary';
import CardapioDigitalDemo from '@/pages/CardapioDigitalDemo';

const queryClient = new QueryClient();

// Component to handle PWA manifest
const PWAManifestHandler = () => {
  usePWAManifest();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UpdateNotification />
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionHandler />
          <PWAManifestHandler />
          <ErrorBoundary>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/para-restaurantes" element={<LandingRestaurantes />} />
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/:empresaNome" element={<Auth />} />
            <Route path="/auth/cliente" element={<AuthCliente />} />
            {/* Public menu routes for customers - accessible without login */}
            <Route path="/menu/:empresaId" element={<Menu />} />
            <Route path="/menu/:empresaId/:mesaId" element={<Menu />} />
            <Route path="/cardapio/:empresaId" element={<Menu />} />
            <Route path="/cardapio/:empresaId/:mesaId" element={<Menu />} />
            {/* PWA Install page */}
            <Route path="/install" element={<Install />} />
            {/* Demo - Cardápio Digital para teste UX */}
            <Route path="/cardapio-demo" element={<CardapioDigitalDemo />} />
            {/* Planos e Assinatura */}
            <Route path="/planos" element={<Planos />} />
            <Route path="/subscription/success" element={<SubscriptionSuccess />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Super Admin (Desenvolvedor) */}
            <Route path="/super-admin" element={<SuperAdmin />} />
            {/* Delivery marketplace */}
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/delivery/auth" element={<DeliveryAuth />} />
            <Route path="/delivery/orders" element={<DeliveryOrders />} />
            <Route path="/delivery/profile" element={<DeliveryProfile />} />
            <Route path="/delivery/:empresaId" element={<DeliveryRestaurant />} />
            <Route path="/delivery/success" element={<DeliverySuccess />} />
            <Route path="/delivery/tracking/:pedidoId" element={<DeliveryTracking />} />
            <Route path="/admin" element={
              <SubscriptionGuard>
                <AdminLayout />
              </SubscriptionGuard>
            }>
              <Route index element={<Dashboard />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="mesas" element={<Mesas />} />
              <Route path="cardapio" element={<Cardapio />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="delivery" element={<PedidosDelivery />} />
              <Route path="delivery/dashboard" element={<DeliveryDashboard />} />
              <Route path="entregador" element={<EntregadorPanel />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="caixa" element={<Caixa />} />
              <Route path="equipe" element={<Equipe />} />
              <Route path="empresa" element={<Empresa />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="garcom" element={<Garcom />} /> 
              <Route path="assinatura" element={<Assinatura />} /> 
              <Route path="diagnostico-stripe" element={<DiagnosticoStripe />} /> 
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function SubscriptionHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    try {
      // Ignorar rotas de subscription (já tratam o fluxo)
      if (location.pathname.startsWith('/subscription')) {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscription') === 'success') {
        const planoId = params.get('planoId');
        const periodo = params.get('periodo');
        const sessionId = params.get('session_id');

        (async () => {
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
              // Usuário logado: verificar se tem empresa
              const { data: prof } = await supabase
                .from('profiles')
                .select('empresa_id')
                .eq('id', user.id)
                .single();

              if (prof?.empresa_id) {
                // Upgrade: processar assinatura diretamente sem deslogar
                if (sessionId) {
                  try {
                    await supabase.functions.invoke('process-subscription', {
                      body: { sessionId, empresaId: prof.empresa_id, planoId, periodo },
                    });
                  } catch (e) {
                    console.warn('Erro ao processar assinatura inline:', e);
                  }
                }
                // Redirecionar para o admin sem deslogar
                navigate('/admin', { replace: true });
                return;
              }
            }

            // Novo usuário (sem empresa): redirecionar para /subscription/success
            const successParams = new URLSearchParams();
            if (sessionId) successParams.set('session_id', sessionId);
            if (planoId) successParams.set('planoId', planoId);
            if (periodo) successParams.set('periodo', periodo);
            navigate(`/subscription/success?${successParams.toString()}`, { replace: true });
          } catch (e) {
            console.warn('Erro no SubscriptionHandler:', e);
          }
        })();
      }
    } catch (e) {
      // ignore
    }
  }, [navigate, location.pathname]);
  return null;
}

export default App;
