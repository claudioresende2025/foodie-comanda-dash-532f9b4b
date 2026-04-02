import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, X, Smartphone, Monitor, Share, MoreVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent;
  }
}

interface PWAInstallPromptProps {
  variant?: 'banner' | 'floating' | 'modal';
  showOnMobile?: boolean;
  showOnDesktop?: boolean;
  autoShowDelay?: number;
}

export function PWAInstallPrompt({ 
  variant = 'floating',
  showOnMobile = true,
  showOnDesktop = true,
  autoShowDelay = 30000 // 30 segundos para mostrar automaticamente
}: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Verificar se já está instalado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detectar dispositivo
    const userAgent = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    const mobile = /android|iphone|ipad|ipod|mobile/.test(userAgent);
    setIsIOS(ios);
    setIsMobile(mobile);

    // Verificar permissões de exibição
    if (mobile && !showOnMobile) return;
    if (!mobile && !showOnDesktop) return;

    // Verificar se usuário já recusou recentemente
    const lastDismissed = localStorage.getItem('pwa_install_dismissed');
    if (lastDismissed) {
      const dismissedAt = new Date(lastDismissed);
      const hoursSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) return; // Não mostrar por 24h após recusar
    }

    // Verificar prompt existente
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
    }

    // Listener para beforeinstallprompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.deferredPrompt = e;
      
      // Mostrar após delay
      if (autoShowDelay > 0) {
        setTimeout(() => setIsVisible(true), autoShowDelay);
      }
    };

    // Listener para app instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      toast.success('🎉 App instalado com sucesso!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Para iOS, mostrar instruções após delay
    if (ios && autoShowDelay > 0) {
      setTimeout(() => setIsVisible(true), autoShowDelay);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showOnMobile, showOnDesktop, autoShowDelay]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      toast.info('Use o menu do navegador para instalar o app');
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Erro ao instalar PWA:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIOSInstructions(false);
    localStorage.setItem('pwa_install_dismissed', new Date().toISOString());
  };

  // Não mostrar se já instalado ou não visível
  if (isInstalled || !isVisible) return null;

  // Instruções para iOS
  if (showIOSInstructions) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-sm w-full animate-in fade-in slide-in-from-bottom-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-orange-500" />
                Instalar no iOS
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={handleDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>Siga os passos abaixo:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                <Share className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm">1. Toque no ícone <strong>Compartilhar</strong></p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                <Plus className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm">2. Selecione <strong>"Adicionar à Tela Inicial"</strong></p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full">
                <Download className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-sm">3. Toque em <strong>"Adicionar"</strong></p>
            </div>
            <Button onClick={handleDismiss} className="w-full">
              Entendi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Floating button (canto inferior direito)
  if (variant === 'floating') {
    return (
      <div className="fixed bottom-20 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Card className="shadow-lg border-orange-200 dark:border-orange-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              {isMobile ? (
                <Smartphone className="w-5 h-5 text-orange-600" />
              ) : (
                <Monitor className="w-5 h-5 text-orange-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Instalar App</p>
              <p className="text-xs text-muted-foreground">Acesso rápido e offline</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={handleInstall}>
                <Download className="w-4 h-4 mr-1" />
                Instalar
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Banner (topo da página)
  if (variant === 'banner') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 animate-in fade-in slide-in-from-top-4">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            <span className="text-sm font-medium">Instale o Food Comanda Pro para acesso offline!</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleInstall}>
              Instalar
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default PWAInstallPrompt;
