import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Empresa = {
  id: string;
  nome_fantasia: string;
  logo_url: string | null;
  endereco_completo: string | null;
};

type ConfigDelivery = {
  empresa_id: string;
  delivery_ativo: boolean;
  taxa_entrega: number;
  tempo_estimado_min: number;
  tempo_estimado_max: number;
  pedido_minimo: number;
};

export type RestaurantWithConfig = Empresa & { config?: ConfigDelivery };

export function useDeliveryRestaurants() {
  const [empresas, setEmpresas] = useState<RestaurantWithConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEmpresas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all delivery configs that are active
      const { data: configs, error: configError } = await supabase
        .from('config_delivery')
        .select('*')
        .eq('delivery_ativo', true);

      if (configError) throw configError;

      if (!configs || configs.length === 0) {
        setEmpresas([]);
        return;
      }

      // Get empresas for active configs
      const empresaIds = configs.map(c => c.empresa_id);
      const { data: empresasData, error: empresasError } = await supabase
        .from('empresas')
        .select('id, nome_fantasia, logo_url, endereco_completo')
        .in('id', empresaIds);

      if (empresasError) throw empresasError;

      // Merge data
      const merged = (empresasData || []).map(empresa => ({
        ...empresa,
        config: configs.find(c => c.empresa_id === empresa.id),
      }));

      setEmpresas(merged);
    } catch (err) {
      console.error('Error fetching empresas:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch restaurants'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  const filteredEmpresas = useMemo(() => {
    if (!searchQuery) return empresas;
    const query = searchQuery.toLowerCase();
    return empresas.filter(e =>
      e.nome_fantasia.toLowerCase().includes(query) ||
      e.endereco_completo?.toLowerCase().includes(query)
    );
  }, [empresas, searchQuery]);

  return {
    empresas: filteredEmpresas,
    allEmpresas: empresas,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    refetch: fetchEmpresas,
  };
}
