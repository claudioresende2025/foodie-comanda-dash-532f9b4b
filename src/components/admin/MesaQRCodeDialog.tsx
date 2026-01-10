import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type MesaQRCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mesaNumero: number;
  mesaId: string;
  empresaId: string;
  mesaStatus?: 'disponivel' | 'ocupada' | 'reservada' | 'juncao';
};

// URL base usando o dominio atual
const BASE_CLIENT_URL = window.location.origin;

export function MesaQRCodeDialog({ open, onOpenChange, mesaNumero, mesaId, empresaId, mesaStatus }: MesaQRCodeDialogProps) {
  const menuUrl = `${BASE_CLIENT_URL}/menu/${empresaId}/${mesaId}`;

  const [reservation, setReservation] = useState<null | { nome_cliente?: string | null; data_reserva?: string | null; horario_reserva?: string | null }>(null);
  const [loadingReserva, setLoadingReserva] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!mesaId || !empresaId) return;
    if (mesaStatus !== 'reservada') {
      setReservation(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setLoadingReserva(true);
        const { data, error } = await supabase
          .from('reservas')
          .select('nome_cliente, data_reserva, horario_reserva')
          .eq('mesa_id', mesaId)
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (mounted) setReservation(data as any ?? null);
      } catch (err) {
        console.warn('Erro ao buscar reserva:', err);
      } finally {
        if (mounted) setLoadingReserva(false);
      }
    })();
    return () => { mounted = false; };
  }, [open, mesaId, empresaId, mesaStatus]);

  const handleDownload = () => {
    const svg = document.getElementById('mesa-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qrcode-mesa-${mesaNumero}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      toast.success('QR Code baixado!');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Cardapio - Mesa ${mesaNumero}`,
          text: `Acesse nosso cardapio digital escaneando o QR Code ou clicando no link:`,
          url: menuUrl,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Erro ao compartilhar');
        }
      }
    } else {
      await navigator.clipboard.writeText(menuUrl);
      toast.success('Link copiado!');
    }
  };

  const handleOpenMenu = async () => {
    // Atualiza status da mesa para 'ocupada' ao visualizar o cardápio
    if (mesaId && empresaId) {
      try {
        await supabase
          .from('mesas')
          .update({ status: 'ocupada' })
          .eq('id', mesaId);
      } catch {
        // Silencia erro para não bloquear a experiência do cliente
      }
    }
    window.open(menuUrl, '_blank');
  };

  const handleCancelarComanda = async () => {
    try {
      const { data: comanda } = await supabase
        .from('comandas')
        .select('id')
        .eq('mesa_id', mesaId)
        .eq('status', 'aberta')
        .limit(1)
        .maybeSingle();

      if (!comanda) {
        toast.error('Nenhuma comanda aberta encontrada para esta mesa');
        return;
      }

      // Marca comanda como cancelada
      const { error: err } = await supabase
        .from('comandas')
        .update({ status: 'cancelada', data_fechamento: new Date().toISOString() })
        .eq('id', comanda.id);

      if (err) throw err;

      // Libera a mesa
      await supabase
        .from('mesas')
        .update({ status: 'disponivel', nome: null, mesa_juncao_id: null })
        .eq('id', mesaId);

      toast.success('Comanda cancelada e mesa liberada');
      onOpenChange(false);
    } catch (e) {
      console.error('Erro cancelando comanda:', e);
      toast.error('Erro ao cancelar comanda');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">QR Code - Mesa {mesaNumero}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="bg-white p-4 rounded-2xl shadow-lg">
            <QRCodeSVG id="mesa-qr-code" value={menuUrl} size={200} level="H" includeMargin bgColor="#ffffff" fgColor="#000000" />
          </div>

          <p className="text-sm text-muted-foreground text-center">Escaneie para acessar o cardapio</p>

          {/* Reserva info */}
          {loadingReserva ? (
            <p className="text-sm text-muted-foreground text-center">Carregando reserva...</p>
          ) : reservation ? (
            <div className="w-full bg-muted/10 p-3 rounded-md text-sm text-muted-foreground text-center">
              <div className="font-medium">Reserva</div>
              <div>Nome: {reservation.nome_cliente || '—'}</div>
              <div>Data: {reservation.data_reserva || '—'}</div>
              <div>Horário: {reservation.horario_reserva || '—'}</div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 justify-center w-full">
            <Button variant="outline" onClick={handleDownload} className="flex-1 min-w-[120px]">
              <Download className="w-4 h-4 mr-2" />
              Baixar
            </Button>
            <Button variant="outline" onClick={handleShare} className="flex-1 min-w-[120px]">
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
            </Button>
          </div>
          <Button onClick={handleOpenMenu} className="w-full">
            <ExternalLink className="w-4 h-4 mr-2" />
            Visualizar Cardapio
          </Button>

          <div className="flex gap-2 mt-2">
            <Button variant="destructive" onClick={handleCancelarComanda} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Cancelar Comanda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
