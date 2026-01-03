import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
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
import { AdminLayout } from "@/components/admin/AdminLayout";
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
import Marketing from "@/pages/admin/Marketing";
import usePWAManifest from "@/hooks/usePWAManifest";
import { UpdateNotification } from "@/components/UpdateNotification";

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
          <PWAManifestHandler />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            {/* Public menu route for customers */}
            <Route path="/menu/:empresaId" element={<Menu />} />
            <Route path="/menu/:empresaId/:mesaId" element={<Menu />} />
            {/* PWA Install page */}
            <Route path="/install" element={<Install />} />
            {/* Delivery marketplace */}
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/delivery/auth" element={<DeliveryAuth />} />
            <Route path="/delivery/orders" element={<DeliveryOrders />} />
            <Route path="/delivery/profile" element={<DeliveryProfile />} />
            <Route path="/delivery/:empresaId" element={<DeliveryRestaurant />} />
            <Route path="/delivery/success" element={<DeliverySuccess />} />
            <Route path="/delivery/tracking/:pedidoId" element={<DeliveryTracking />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="mesas" element={<Mesas />} />
              <Route path="cardapio" element={<Cardapio />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="delivery" element={<PedidosDelivery />} />
              <Route path="delivery/dashboard" element={<DeliveryDashboard />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="caixa" element={<Caixa />} />
              <Route path="equipe" element={<Equipe />} />
              <Route path="empresa" element={<Empresa />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              
              {/* 🛑 A ROTA FALTANDO ESTÁ AQUI: */}
              <Route path="garcom" element={<Garcom />} /> 
              
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
