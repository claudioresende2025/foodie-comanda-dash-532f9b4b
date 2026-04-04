import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Copy, CheckCircle, Users, Gift, Share2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReferralCard() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const [copied, setCopied] = useState(false);

  // Fetch or create referral code
  const { data: indicacao, refetch } = useQuery({
    queryKey: ['indicacao', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;

      // Check existing
      const { data: existing } = await (supabase as any)
        .from('indicacoes')
        .select('*')
        .eq('empresa_indicadora_id', empresaId)
        .is('empresa_indicada_id', null)
        .limit(1)
        .single();

      if (existing) return existing;

      // Fetch empresa name to generate code
      const { data: empresa } = await supabase
        .from('empresas')
        .select('nome_fantasia')
        .eq('id', empresaId)
        .single();

      const slug = (empresa?.nome_fantasia || 'REF')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 8);
      const code = `REF-${slug}${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;

      const { data: created } = await (supabase as any)
        .from('indicacoes')
        .insert({ empresa_indicadora_id: empresaId, codigo_indicacao: code })
        .select()
        .single();

      return created;
    },
    enabled: !!empresaId,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch referral stats
  const { data: stats } = useQuery({
    queryKey: ['indicacao-stats', empresaId],
    queryFn: async () => {
      if (!empresaId) return { total: 0, convertidas: 0 };
      const { data } = await (supabase as any)
        .from('indicacoes')
        .select('status')
        .eq('empresa_indicadora_id', empresaId)
        .not('empresa_indicada_id', 'is', null);

      const all = data || [];
      return {
        total: all.length,
        convertidas: all.filter((i: any) => i.status === 'convertida' || i.status === 'recompensada').length,
      };
    },
    enabled: !!empresaId,
    staleTime: 60 * 1000,
  });

  const referralLink = indicacao?.codigo_indicacao
    ? `${window.location.origin}/planos?ref=${indicacao.codigo_indicacao}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Foodie Comanda - Indique e Ganhe',
          text: 'Use meu código de indicação e ganhe 7 dias extras de teste!',
          url: referralLink,
        });
      } catch (e) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  if (!indicacao) return null;

  return (
    <Card className="shadow-fcd border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="w-5 h-5 text-accent" />
          Programa de Indicação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Indique outros restaurantes e ganhe <strong>1 mês de desconto</strong> na sua assinatura. 
          Quem você indicar ganha <strong>7 dias extras</strong> de teste.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">Seu link de indicação</label>
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <CheckCircle className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Código: {indicacao.codigo_indicacao}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Users className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Indicações</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/5">
            <CheckCircle className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats?.convertidas || 0}</p>
            <p className="text-xs text-muted-foreground">Convertidas</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
