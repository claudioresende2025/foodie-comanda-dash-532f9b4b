import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { useNavigate } from 'react-router-dom';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feature?: string | null;
};

export function UpgradeModal({ open, onOpenChange, feature }: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recurso indisponível</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            Este recurso{feature ? ` (${feature})` : ''} não está disponível no seu plano atual. Faça o upgrade para liberar o acesso.
          </p>

          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Bronze</h3>
              <p className="text-sm">R$129,90/mês • Trial 3 dias</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Prata</h3>
              <p className="text-sm">R$199,90/mês • Trial 3 dias</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Ouro</h3>
              <p className="text-sm">R$489,90/mês • Trial 7 dias</p>
            </Card>
          </div>

          <div className="flex justify-end items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate('/planos');
              }}
            >
              Fazer upgrade
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
