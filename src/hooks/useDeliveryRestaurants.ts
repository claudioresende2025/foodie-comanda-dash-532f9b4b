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

      // 1. Buscamos todas as empresas primeiro
      const { data: empresasData, error: empresasError } = await supabase
        .from('empresas')
        .select('id, nome_fantasia, logo_url, endereco_completo');

      if (empresasError) throw empresasError;

      if (!empresasData || empresasData.length === 0) {
        setEmpresas([]);
        return;
      }

      // 2. Buscamos as configurações de delivery
      const { data: configs, error: configError } = await supabase
        .from('config_delivery')
        .select('*');

      if (configError) {
        console.error('Erro ao buscar configs (não crítico):', configError);
      }

      // 3. Cruzamos os dados
      // Filtramos apenas empresas que possuem config E que o delivery está ativo
      // OU você pode remover o filtro .filter para mostrar todas e tratar no card
      const merged = empresasData
        .map(empresa => ({
          ...empresa,
          config: configs?.find(c => c.empresa_id === empresa.id),
        }))
        .filter(e => e.config?.delivery_ativo === true); // Garante que só aparece quem configurou o delivery

      console.log('[useDeliveryRestaurants] Empresas encontradas:', merged.length);
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
    const listaParaFiltrar = empresas || [];
    if (!searchQuery) return listaParaFiltrar;
    
    const query = searchQuery.toLowerCase();
    return listaParaFiltrar.filter(e =>
      e.nome_fantasia?.toLowerCase().includes(query) ||
      e.endereco_completo?.toLowerCase().includes(query)
    );
  }, [empresas, searchQuery]);

  return {
    empresas: filteredEmpresas,
    allEmpresas: empresas,
    isLoading,
    error,
    isError: !!error, // Adicionado para compatibilidade com o componente
    searchQuery,
    setSearchQuery,
    refetch: fetchEmpresas,
  };
}
