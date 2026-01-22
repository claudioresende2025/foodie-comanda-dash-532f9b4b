import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Crown, Zap, Building2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feature?: string | null;
  currentPlan?: string | null;
  // Novas props para modo de bloqueio
  showExitButton?: boolean;
  onExit?: () => void;
  blockingReason?: string;
  isBlocking?: boolean;
};

const planos = [
  {
    nome: 'Bronze',
    slug: 'bronze',
    preco: 149.90,
    trial: 3,
    icon: Zap,
    destaque: false,
    recursos: [
      { nome: 'Dashboard', incluso: true, detalhe: 'Básico' },
      { nome: 'Cardápio', incluso: true },
      { nome: 'Mesas', incluso: true, detalhe: 'Limite 10' },
      { nome: 'Delivery', incluso: true, detalhe: 'WhatsApp' },
      { nome: 'Caixa', incluso: true, detalhe: 'Fluxo + Estoque' },
      { nome: 'App Garçom', incluso: true, detalhe: '1 usuário' },
      { nome: 'KDS', incluso: true, detalhe: '1 tela' },
      { nome: 'Equipe', incluso: true, detalhe: 'Até 2 colaboradores' },
      { nome: 'Estatísticas Delivery', incluso: false },
      { nome: 'Marketing', incluso: false },
    ],
  },
  {
    nome: 'Prata',
    slug: 'prata',
    preco: 299.90,
    trial: 3,
    icon: Crown,
    destaque: true,
    recursos: [
      { nome: 'Dashboard', incluso: true, detalhe: 'Completo' },
      { nome: 'Cardápio', incluso: true },
      { nome: 'Mesas', incluso: true, detalhe: 'Ilimitado' },
      { nome: 'Delivery', incluso: true, detalhe: 'Integrado' },
      { nome: 'Caixa', incluso: true, detalhe: 'Completo + Estoque' },
      { nome: 'App Garçom', incluso: true, detalhe: 'Até 3 usuários' },
      { nome: 'KDS', incluso: true, detalhe: '1 tela' },
      { nome: 'Equipe', incluso: true, detalhe: 'Até 5 colaboradores' },
      { nome: 'Estatísticas Delivery', incluso: false },
      { nome: 'Marketing', incluso: false },
    ],
  },
  {
    nome: 'Ouro',
    slug: 'ouro',
    preco: 549.90,
    trial: 7,
    icon: Building2,
    destaque: false,
    recursos: [
      { nome: 'Dashboard', incluso: true, detalhe: 'Avançado + Comparativos' },
      { nome: 'Cardápio', incluso: true },
      { nome: 'Mesas', incluso: true, detalhe: 'Ilimitado' },
      { nome: 'Delivery', incluso: true, detalhe: 'Integrado' },
      { nome: 'Caixa', incluso: true, detalhe: 'Completo + Auditoria' },
      { nome: 'App Garçom', incluso: true, detalhe: 'Ilimitado' },
      { nome: 'KDS', incluso: true, detalhe: 'Ilimitado' },
      { nome: 'Equipe', incluso: true, detalhe: 'Ilimitado' },
      { nome: 'Estatísticas Delivery', incluso: true },
      { nome: 'Marketing', incluso: true, detalhe: 'Cupons + Fidelidade' },
    ],
  },
];

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
};

export function UpgradeModal({ 
  open, 
  onOpenChange, 
  feature, 
  currentPlan,
  showExitButton = false,
  onExit,
  blockingReason,
  isBlocking = false
}: Props) {
  const navigate = useNavigate();

  const handleUpgrade = (planoSlug: string) => {
    onOpenChange(false);
    navigate(`/planos?mode=upgrade&plano=${planoSlug}`);
  };

  const handleDowngrade = () => {
    onOpenChange(false);
    navigate('/planos?mode=downgrade');
  };

  // Título e descrição dinâmicos baseado no contexto
  const getTitle = () => {
    if (isBlocking) return 'Escolha um Plano para Continuar';
    return 'Recurso Indisponível';
  };

  const getDescription = () => {
    if (blockingReason) return blockingReason;
    if (feature) return `O recurso "${feature}" não está disponível no seu plano atual.`;
    return 'Este recurso não está disponível no seu plano atual.';
  };

  return (
    <Dialog open={open} onOpenChange={isBlocking ? undefined : onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          <DialogTitle className="text-xl font-bold text-center">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-center">
            {getDescription()}
            {!isBlocking && <><br />Faça upgrade para liberar o acesso completo.</>}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {planos.map((plano) => {
              const Icon = plano.icon;
              const isCurrentPlan = currentPlan?.toLowerCase() === plano.slug;
              
              return (
                <Card 
                  key={plano.slug} 
                  className={`p-4 relative ${
                    plano.destaque 
                      ? 'border-primary shadow-lg ring-2 ring-primary/20' 
                      : ''
                  } ${isCurrentPlan ? 'bg-primary/5 border-primary' : ''}`}
                >
                  {plano.destaque && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                      Mais Popular
                    </Badge>
                  )}
                  
                  {isCurrentPlan && (
                    <Badge variant="outline" className="absolute -top-2 right-2 border-primary text-primary">
                      Seu Plano
                    </Badge>
                  )}

                  <div className="text-center mb-4">
                    <div className={`w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center ${
                      plano.destaque ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg">{plano.nome}</h3>
                    <div className="mt-2">
                      <span className="text-2xl font-bold">{formatPrice(plano.preco)}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Trial de {plano.trial} dias
                    </p>
                  </div>

                  <div className="space-y-2 mb-4">
                    {plano.recursos.slice(0, 6).map((recurso, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {recurso.incluso ? (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={recurso.incluso ? '' : 'text-muted-foreground line-through'}>
                          {recurso.nome}
                          {recurso.detalhe && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({recurso.detalhe})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    className="w-full" 
                    variant={plano.destaque ? 'default' : 'outline'}
                    onClick={() => handleUpgrade(plano.slug)}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? 'Plano Atual' : 'Selecionar'}
                  </Button>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center gap-4 pt-4 border-t">
            {showExitButton && onExit ? (
              <>
                <Button variant="outline" onClick={onExit} className="gap-2">
                  <LogOut className="w-4 h-4" />
                  Sair da Conta
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button variant="outline" onClick={handleDowngrade}>
                  Fazer Downgrade
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
