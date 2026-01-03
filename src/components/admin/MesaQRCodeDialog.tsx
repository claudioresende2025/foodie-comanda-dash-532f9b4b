import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type MesaQRCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mesaNumero: number;
  mesaId: string;
  empresaId: string;
};

// URL base usando o domínio atual
const BASE_CLIENT_URL = window.location.origin;

export function MesaQRCodeDialog({
  open,
  onOpenChange,
  mesaNumero,
  mesaId,
  empresaId,
}: MesaQRCodeDialogProps) {
  // Cria a URL usando a base pública
  const menuUrl = `${BASE_CLIENT_URL}/menu/${empresaId}/${mesaId}`;

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
          title: `Cardápio - Mesa ${mesaNumero}`,
          text: `Acesse nosso cardápio digital escaneando o QR Code ou clicando no link:`,
          url: menuUrl,
        });
      } catch (error) {
        // User cancelled or error
        if ((error as Error).name !== 'AbortError') {
          toast.error('Erro ao compartilhar');
        }
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(menuUrl);
      toast.success('Link copiado!');
    }
  };

  const handleOpenMenu = () => {
    window.open(menuUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            QR Code - Mesa {mesaNumero}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="bg-white p-4 rounded-2xl shadow-lg">
            <QRCodeSVG
              id="mesa-qr-code"
              value={menuUrl}
              size={200}
              level="H"
              includeMargin
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Escaneie para acessar o cardápio
          </p>

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
            Visualizar Cardápio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
