import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, FileText, ExternalLink, AlertCircle, Check } from 'lucide-react';

interface NfceItem {
  nome: string;
  ncm: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface NfceEmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    comandaId: string;
    empresaId: string;
    itens: NfceItem[];
    valorTotal: number;
    formaPagamento: string;
  } | null;
}

export function NfceEmissionDialog({ open, onOpenChange, data }: NfceEmissionDialogProps) {
  const [isEmitting, setIsEmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    status: string;
    danfe_url?: string | null;
    erro_sefaz?: string | null;
    chave_acesso?: string | null;
  } | null>(null);

  const handleEmit = async () => {
    if (!data) return;

    setIsEmitting(true);
    setResult(null);

    try {
      const { data: response, error } = await supabase.functions.invoke('emit-nfce', {
        body: {
          empresa_id: data.empresaId,
          itens: data.itens,
          valor_total: data.valorTotal,
          forma_pagamento: data.formaPagamento,
          comanda_id: data.comandaId || undefined,
        },
      });

      if (error) throw error;

      setResult(response);

      if (response.success) {
        toast.success('NFC-e emitida com sucesso!');
      } else if (response.status === 'processando') {
        toast.info('NFC-e em processamento na SEFAZ...');
      } else {
        toast.error('Erro ao emitir NFC-e');
      }
    } catch (err: any) {
      console.error('Erro ao emitir NFC-e:', err);
      toast.error(err.message || 'Erro ao emitir NFC-e');
      setResult({ success: false, status: 'erro', erro_sefaz: err.message });
    } finally {
      setIsEmitting(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Emitir NFC-e
          </DialogTitle>
          <DialogDescription>
            Emita a Nota Fiscal de Consumidor Eletrônica para esta venda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo dos itens */}
          {data && !result && (
            <>
              <ScrollArea className="h-40 border rounded-lg p-3">
                <div className="space-y-2">
                  {data.itens.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.quantidade}x {item.nome}</span>
                      <span className="font-medium">R$ {item.valor_total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="text-lg font-bold">R$ {data.valorTotal.toFixed(2)}</span>
              </div>

              <Button onClick={handleEmit} disabled={isEmitting} className="w-full">
                {isEmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Emitindo NFC-e...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Emitir NFC-e
                  </>
                )}
              </Button>
            </>
          )}

          {/* Resultado */}
          {result && (
            <div className="space-y-4">
              {result.success ? (
                <div className="p-4 border rounded-lg bg-green-500/10 space-y-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">NFC-e emitida com sucesso!</span>
                  </div>
                  {result.chave_acesso && (
                    <p className="text-xs text-muted-foreground break-all">
                      Chave: {result.chave_acesso}
                    </p>
                  )}
                  {result.danfe_url && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={result.danfe_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Visualizar DANFE (PDF)
                      </a>
                    </Button>
                  )}
                </div>
              ) : result.status === 'processando' ? (
                <div className="p-4 border rounded-lg bg-yellow-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-medium">Processando na SEFAZ...</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A nota está sendo processada. Verifique o status em alguns minutos.
                  </p>
                </div>
              ) : (
                <div className="p-4 border rounded-lg bg-destructive/10 space-y-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Erro na emissão</span>
                  </div>
                  {result.erro_sefaz && (
                    <p className="text-sm text-muted-foreground">{result.erro_sefaz}</p>
                  )}
                  <Button onClick={handleEmit} variant="outline" className="w-full">
                    Tentar Novamente
                  </Button>
                </div>
              )}

              <Button onClick={handleClose} variant="secondary" className="w-full">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
