import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AvaliacaoPendente {
  id: string;
  pedido_delivery_id: string;
  empresa_id: string;
  nome_restaurante: string;
  bairro: string | null;
  created_at: string;
}

export function useAvaliacoesPendentes(userId: string | undefined) {
  const [pendentes, setPendentes] = useState<AvaliacaoPendente[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchPendentes = useCallback(async () => {
    if (!userId) {
      setPendentes([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('avaliacoes_pendentes')
        .select('*')
        .eq('user_id', userId)
        .eq('expirado', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPendentes(data || []);
    } catch (error) {
      console.error('Erro ao buscar avaliações pendentes:', error);
      setPendentes([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPendentes();
  }, [fetchPendentes]);

  const marcarAvaliada = useCallback((pedidoId: string) => {
    setPendentes(prev => prev.filter(p => p.pedido_delivery_id !== pedidoId));
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const proximaAvaliacao = useCallback(() => {
    if (currentIndex < pendentes.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, pendentes.length]);

  const avaliacaoAtual = pendentes[currentIndex] || null;
  const totalPendentes = pendentes.length;
  const temPendentes = pendentes.length > 0;

  return {
    pendentes,
    avaliacaoAtual,
    totalPendentes,
    temPendentes,
    isLoading,
    marcarAvaliada,
    proximaAvaliacao,
    refetch: fetchPendentes,
  };
}
