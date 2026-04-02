import { useEffect, lazy, Suspense } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { sincronizarTudo } from "./lib/db";
import { connectionManager } from "./lib/connectionManager";
import { initPWAMigration } from "./lib/pwaMigration";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useNavigate, useLocation } from 'react-router-dom';
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import usePWAManifest from "@/hooks/usePWAManifest";
import { UpdateNotification } from "@/components/UpdateNotification";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import ErrorBoundary from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// ============================================
// CODE SPLITTING: React.lazy para todas as páginas
// Cada rota é carregada sob demanda — Login não carrega Mesas, etc.
// ============================================
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AuthCliente = lazy(() => import("@/pages/AuthCliente"));
const EmailConfirmation = lazy(() => import("@/pages/EmailConfirmation"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Menu = lazy(() => import("@/pages/Menu"));
const Delivery = lazy(() => import("@/pages/Delivery"));
const DeliveryRestaurant = lazy(() => import("@/pages/DeliveryRestaurant"));
const DeliverySuccess = lazy(() => import("@/pages/DeliverySuccess"));
const DeliveryTracking = lazy(() => import("@/pages/DeliveryTracking"));
const DeliveryAuth = lazy(() => import("@/pages/DeliveryAuth"));
const DeliveryOrders = lazy(() => import("@/pages/DeliveryOrders"));
const DeliveryProfile = lazy(() => import("@/pages/DeliveryProfile"));
const Install = lazy(() => import("@/pages/Install"));
const Index = lazy(() => import("@/pages/Index"));
const LandingRestaurantes = lazy(() => import("@/pages/LandingRestaurantes"));
const Planos = lazy(() => import("@/pages/Planos"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin"));
const SubscriptionSuccess = lazy(() => import("@/pages/subscription/Success"));
const CardapioDigitalDemo = lazy(() => import("@/pages/CardapioDigitalDemo"));

// Admin pages
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Onboarding = lazy(() => import("@/pages/admin/Onboarding"));
const Mesas = lazy(() => import("@/pages/admin/Mesas"));
const Cardapio = lazy(() => import("@/pages/admin/Cardapio"));
const Pedidos = lazy(() => import("@/pages/admin/Pedidos"));
const Caixa = lazy(() => import("@/pages/admin/Caixa"));
const Equipe = lazy(() => import("@/pages/admin/Equipe"));
const Empresa = lazy(() => import("@/pages/admin/Empresa"));
const Configuracoes = lazy(() => import("@/pages/admin/Configuracoes"));
const Garcom = lazy(() => import("@/pages/admin/Garcom"));
const PedidosDelivery = lazy(() => import("@/pages/admin/PedidosDelivery"));
const DeliveryDashboard = lazy(() => import("@/pages/admin/DeliveryDashboard"));
const EntregadorPanel = lazy(() => import("@/pages/admin/EntregadorPanel"));
const Marketing = lazy(() => import("@/pages/admin/Marketing"));
const Assinatura = lazy(() => import("@/pages/admin/Assinatura"));
const DiagnosticoStripe = lazy(() => import("@/pages/admin/DiagnosticoStripe"));
const AdminDesempenho = lazy(() => import("@/pages/admin/AdminDesempenho"));
const AdminAvaliacoes = lazy(() => import("@/pages/admin/AdminAvaliacoes"));

// Fallback de carregamento global para Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
  </div>
);

// QueryClient configurado para Offline-First
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Manter dados em cache por 5 minutos mesmo quando stale
      staleTime: 5 * 60 * 1000,
      // Manter dados em cache por 30 minutos
      gcTime: 30 * 60 * 1000,
      // Não refetch automático em reconexão (o ConnectionManager cuida disso)
      refetchOnReconnect: false,
      // Não refetch em foco de janela offline
      refetchOnWindowFocus: false,
      // Retry apenas quando online
      retry: (failureCount, error) => {
        if (!navigator.onLine) return false;
        return failureCount < 3;
      },
      // Permitir dados stale quando offline (não mostrar loading)
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Mutations também funcionam offline
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => {
        if (!navigator.onLine) return false;
        return failureCount < 3;
      },
    },
  },
});

const PWAManifestHandler = () => {
  usePWAManifest();
  return null;
};

// --- ALTERAÇÃO AQUI: Transformamos o App para suportar o useEffect ---
const App = () => {

  // Log de diagnóstico inicial
  useEffect(() => {
    console.log('[App] 🚀 Food Comanda Pro iniciando...');
    console.log('[App] 📍 Rota atual:', window.location.pathname);
    console.log('[App] 🔐 isSuperAdmin (session):', sessionStorage.getItem('isSuperAdmin'));
    console.log('[App] 🌐 Online:', navigator.onLine);
  }, []);

  // Inicializar o ConnectionManager (Sistema de Detecção Automática)
  useEffect(() => {
    // Se é Super Admin, NÃO inicializar ConnectionManager (não precisa de offline)
    if (sessionStorage.getItem('isSuperAdmin') === 'true') {
      console.log('[App] 🛡️ Super Admin - pulando inicialização de ConnectionManager');
      return;
    }
    
    console.log("🚀 Inicializando sistema de conexão automática...");
    connectionManager.init();

    // Inicializar módulo PWA (migração, quota, logs)
    initPWAMigration().catch(console.error);

    return () => {
      connectionManager.destroy();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdateNotification />
        <PWAInstallPrompt variant="floating" autoShowDelay={45000} />
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionHandler />
            <PWAManifestHandler />
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/para-restaurantes" element={<LandingRestaurantes />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/:empresaNome" element={<Auth />} />
                <Route path="/auth/cliente" element={<AuthCliente />} />
                <Route path="/menu/:empresaId" element={<Menu />} />
                <Route path="/menu/:empresaId/:mesaId" element={<Menu />} />
                <Route path="/cardapio/:empresaId" element={<Menu />} />
                <Route path="/cardapio/:empresaId/:mesaId" element={<Menu />} />
                <Route path="/install" element={<Install />} />
                <Route path="/cardapio-demo" element={<CardapioDigitalDemo />} />
                <Route path="/planos" element={<Planos />} />
                <Route path="/subscription/success" element={<SubscriptionSuccess />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/email-confirmation" element={<EmailConfirmation />} />
                <Route path="/super-admin" element={<SuperAdmin />} />
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
                  <Route path="desempenho" element={<AdminDesempenho />} />
                  <Route path="avaliacoes" element={<AdminAvaliacoes />} />
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
              </Suspense>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

function SubscriptionHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    try {
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
              const { data: prof } = await supabase
                .from('profiles')
                .select('empresa_id')
                .eq('id', user.id)
                .single();

              if (prof?.empresa_id) {
                if (sessionId) {
                  try {
                    await supabase.functions.invoke('process-subscription', {
                      body: { sessionId, empresaId: prof.empresa_id, planoId, periodo },
                    });
                  } catch (e) {
                    console.warn('Erro ao processar assinatura inline:', e);
                  }
                }
                navigate('/admin', { replace: true });
                return;
              }
            }

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