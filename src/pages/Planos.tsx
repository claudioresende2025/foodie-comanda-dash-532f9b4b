import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Clock, Phone, Shield, Star, Zap } from 'lucide-react';

// Página simplificada de planos - sem tabela de planos do banco
export default function Planos() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Planos</h1>
              <p className="text-muted-foreground text-sm">Em breve</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Sistema em período de teste gratuito</span>
          </div>
          
          <h2 className="text-4xl font-bold mb-4">
            Gestão completa para seu restaurante
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comandas digitais, delivery, controle de mesas e muito mais
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="border-primary shadow-lg">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
                <Star className="w-8 h-8 fill-current" />
              </div>
              <CardTitle className="text-2xl">Acesso Completo</CardTitle>
              <CardDescription>Todas as funcionalidades liberadas</CardDescription>
            </CardHeader>

            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Cardápio digital com QR Code</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Sistema de comandas</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Gestão de mesas</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Delivery integrado</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Controle de caixa</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">Relatórios e analytics</span>
                </li>
              </ul>
            </CardContent>

            <CardFooter>
              <Button className="w-full" size="lg" onClick={() => navigate('/admin')}>
                Continuar usando
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="mt-20 text-center">
          <h3 className="text-2xl font-bold mb-8">Por que escolher nossa plataforma?</h3>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Seguro</h4>
              <p className="text-sm text-muted-foreground">Seus dados protegidos</p>
            </div>
            
            <div className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Rápido</h4>
              <p className="text-sm text-muted-foreground">Sistema otimizado</p>
            </div>
            
            <div className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Suporte</h4>
              <p className="text-sm text-muted-foreground">Equipe pronta para ajudar</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
