import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface CardapioLinkProps {
  className?: string;
  showCard?: boolean;
}

export function CardapioLink({ className, showCard = true }: CardapioLinkProps) {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);

  // Buscar dados da empresa para obter o slug ou ID
  const { data: empresa, isLoading } = useQuery({
    queryKey: ['empresa-cardapio-link', profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return null;
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome_fantasia')
        .eq('id', profile.empresa_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.empresa_id,
  });

  // Gerar URL do cardápio
  const cardapioUrl = empresa?.id 
    ? `${window.location.origin}/menu/${empresa.id}`
    : '';

  const handleCopy = async () => {
    if (!cardapioUrl) return;
    
    try {
      await navigator.clipboard.writeText(cardapioUrl);
      setCopied(true);
      toast.success('Link copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleOpen = () => {
    if (!cardapioUrl) return;
    window.open(cardapioUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className="animate-pulse bg-muted h-10 rounded-md" />
      </div>
    );
  }

  if (!empresa) {
    return null;
  }

  // Versão simples (sem card)
  if (!showCard) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Input
          value={cardapioUrl}
          readOnly
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          title="Copiar link"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleOpen}
          title="Abrir cardápio"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Versão com card
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Link do Cardápio Digital
        </CardTitle>
        <CardDescription>
          Compartilhe este link com seus clientes para que eles possam acessar o cardápio digital
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cardapio-url">URL do Cardápio</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="cardapio-url"
                value={cardapioUrl}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copiar link"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleOpen}
                title="Abrir cardápio em nova aba"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="default"
              className="flex-1"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={handleOpen}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Visualizar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CardapioLink;
