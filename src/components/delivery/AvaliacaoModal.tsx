import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Star, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AvaliacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedidoId: string;
  empresaId: string;
  nomeRestaurante: string;
  nomeCliente: string;
  bairro?: string | null;
  userId: string;
  onSuccess?: () => void;
}

function StarInput({ 
  value, 
  onChange, 
  label 
}: { 
  value: number; 
  onChange: (rating: number) => void; 
  label: string;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-1 transition-transform hover:scale-110"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => onChange(star)}
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                star <= (hoverRating || value)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-muted text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AvaliacaoModal({
  isOpen,
  onClose,
  pedidoId,
  empresaId,
  nomeRestaurante,
  nomeCliente,
  bairro,
  userId,
  onSuccess,
}: AvaliacaoModalProps) {
  const [notaRestaurante, setNotaRestaurante] = useState(0);
  const [notaProduto, setNotaProduto] = useState(0);
  const [comentario, setComentario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (notaRestaurante === 0) {
      toast.error('Por favor, avalie o restaurante');
      return;
    }

    setIsSubmitting(true);
    try {
      // Inserir avaliação
      const { error: avaliacaoError } = await supabase
        .from('avaliacoes')
        .insert({
          empresa_id: empresaId,
          pedido_delivery_id: pedidoId,
          user_id: userId,
          nota_restaurante: notaRestaurante,
          nota_produto: notaProduto > 0 ? notaProduto : null,
          comentario: comentario.trim() || null,
          nome_cliente: nomeCliente,
          bairro: bairro || null,
        });

      if (avaliacaoError) throw avaliacaoError;

      // Remover da lista de pendentes
      await supabase
        .from('avaliacoes_pendentes')
        .delete()
        .eq('pedido_delivery_id', pedidoId);

      toast.success('Obrigado pela sua avaliação!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePular = async () => {
    // Apenas fechar o modal, a avaliação pendente permanece
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
            Avalie seu pedido
          </DialogTitle>
          <DialogDescription>
            Como foi sua experiência com{' '}
            <span className="font-semibold">{nomeRestaurante}</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <StarInput
            value={notaRestaurante}
            onChange={setNotaRestaurante}
            label="Avaliação do Restaurante *"
          />

          <StarInput
            value={notaProduto}
            onChange={setNotaProduto}
            label="Avaliação dos Produtos (opcional)"
          />

          <div className="space-y-2">
            <Label htmlFor="comentario">Comentário (opcional)</Label>
            <Textarea
              id="comentario"
              placeholder="Conte-nos mais sobre sua experiência..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comentario.length}/500
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handlePular}
            disabled={isSubmitting}
          >
            Avaliar depois
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || notaRestaurante === 0}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Star className="h-4 w-4" />
                Enviar Avaliação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
