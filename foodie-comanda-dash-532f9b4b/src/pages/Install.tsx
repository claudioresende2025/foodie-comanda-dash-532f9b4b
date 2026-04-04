import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Download, 
  Smartphone, 
  Zap, 
  Wifi, 
  Shield, 
  CheckCircle2,
  Share,
  MoreVertical,
  Plus,
  ArrowRight,
  ChefHat,
  Bell,
  Clock
} from "lucide-react";
import logoImage from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Check if there's already a deferred prompt
    const existingPrompt = (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
    if (existingPrompt) {
      setDeferredPrompt(existingPrompt);
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt = promptEvent;
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const features = [
    {
      icon: Zap,
      title: "Ultra Rápido",
      description: "Carregamento instantâneo"
    },
    {
      icon: Wifi,
      title: "Funciona Offline",
      description: "Sem internet também"
    },
    {
      icon: Bell,
      title: "Notificações",
      description: "Alertas em tempo real"
    },
    {
      icon: Shield,
      title: "Seguro",
      description: "Dados protegidos"
    },
    {
      icon: Smartphone,
      title: "Nativo",
      description: "Como app nativo"
    },
    {
      icon: Clock,
      title: "Atualizações",
      description: "Sempre atualizado"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-background to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="px-4 py-6 text-center safe-area-inset-top">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full scale-150" />
            <img 
              src={logoImage} 
              alt="Food Comanda Pro" 
              className="relative w-24 h-24 md:w-32 md:h-32 rounded-3xl shadow-2xl"
            />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center gap-2 justify-center">
              <ChefHat className="w-8 h-8 text-green-600" />
              Food Comanda Pro
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Sistema completo para seu restaurante
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 pb-12">
        {/* Installation Status Card */}
        <Card className="mb-8 overflow-hidden border-0 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 md:p-8">
            {isInstalled ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  App Instalado com Sucesso!
                </h2>
                <p className="text-muted-foreground mb-6">
                  O Food Comanda Pro está pronto para uso no seu dispositivo.
                </p>
                <Button 
                  size="lg" 
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={() => window.location.href = "/"}
                >
                  Abrir Aplicativo
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            ) : deferredPrompt ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6 animate-pulse">
                  <Download className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  Instale o Aplicativo
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Adicione o Food Comanda Pro à sua tela inicial para acesso rápido e experiência completa.
                </p>
                <Button 
                  size="lg" 
                  onClick={handleInstall}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 text-lg px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all"
                >
                  <Download className="w-6 h-6" />
                  Instalar Agora
                </Button>
              </div>
            ) : isIOS ? (
              <div className="py-6">
                <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
                  Como Instalar no iPhone/iPad
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Toque no botão Compartilhar</p>
                      <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
                        <Share className="w-4 h-4" /> na barra de navegação do Safari
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Role para baixo e toque em</p>
                      <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
                        <Plus className="w-4 h-4" /> "Adicionar à Tela de Início"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Confirme tocando em</p>
                      <p className="text-muted-foreground text-sm mt-1">"Adicionar" no canto superior direito</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : isAndroid ? (
              <div className="py-6">
                <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
                  Como Instalar no Android
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Toque no menu do Chrome</p>
                      <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
                        <MoreVertical className="w-4 h-4" /> (três pontos) no canto superior
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Selecione</p>
                      <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
                        <Download className="w-4 h-4" /> "Instalar aplicativo" ou "Adicionar à tela inicial"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Confirme a instalação</p>
                      <p className="text-muted-foreground text-sm mt-1">Toque em "Instalar" no popup</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
                  <Smartphone className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  Acesse pelo celular
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Para a melhor experiência, acesse este site pelo navegador do seu smartphone e siga as instruções de instalação.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
            Por que instalar?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border-0 shadow-lg bg-card/80 backdrop-blur-sm hover:scale-105 transition-transform"
              >
                <CardContent className="p-4 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 mb-3">
                    <feature.icon className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Continue without installing */}
        <div className="text-center">
          <Button 
            variant="ghost" 
            className="text-muted-foreground hover:text-foreground"
            onClick={() => window.location.href = "/"}
          >
            Continuar no navegador
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Install;
