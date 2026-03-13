import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAvaliacoesPendentes } from '@/hooks/useAvaliacoesPendentes';
import AvaliacaoModal from './AvaliacaoModal';
import { Button } from '@/components/ui/button';
import { Star, X, ChevronRight } from 'lucide-react';

interface AvaliacoesPendentesProps {
  nomeCliente?: string;
}

export default function AvaliacoesPendentes({ nomeCliente }: AvaliacoesPendentesProps) {
  const { user } = useAuth();
  const {
    avaliacaoAtual,
    totalPendentes,
    temPendentes,
    marcarAvaliada,
  } = useAvaliacoesPendentes(user?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!temPendentes || dismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
              <Star className="h-5 w-5 text-yellow-600 fill-yellow-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {totalPendentes === 1
                  ? 'Você tem uma avaliação pendente'
                  : `Você tem ${totalPendentes} avaliações pendentes`}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Conte-nos como foi sua experiência com{' '}
                <span className="font-medium">{avaliacaoAtual?.nome_restaurante}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-2"
          >
            <Star className="h-4 w-4" />
            Avaliar agora
          </Button>
          {totalPendentes > 1 && (
            <span className="text-xs text-muted-foreground">
              +{totalPendentes - 1} outra(s)
            </span>
          )}
        </div>
      </div>

      {avaliacaoAtual && (
        <AvaliacaoModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          pedidoId={avaliacaoAtual.pedido_delivery_id}
          empresaId={avaliacaoAtual.empresa_id}
          nomeRestaurante={avaliacaoAtual.nome_restaurante}
          nomeCliente={nomeCliente || 'Cliente'}
          bairro={avaliacaoAtual.bairro}
          userId={user?.id || ''}
          onSuccess={() => {
            marcarAvaliada(avaliacaoAtual.pedido_delivery_id);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}
