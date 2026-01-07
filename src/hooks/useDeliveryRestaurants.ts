import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDeliveryRestaurants() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEmpresas = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[DEBUG] Iniciando busca de empresas...');

      // Busca simples sem filtros complexos para testar
      const { data: empresasData, error: empErr } = await supabase
        .from('empresas')
        .select('*');

      if (empErr) throw empErr;

      const { data: configs } = await supabase
        .from('config_delivery')
        .select('*');

      // Mesclagem simplificada (Forçando a exibição mesmo sem config)
      const merged = (empresasData || []).map(empresa => ({
        ...empresa,
        config: configs?.find(c => c.empresa_id === empresa.id) || { delivery_ativo: true } 
      }));

      console.log('[DEBUG] Dados mesclados:', merged);
      setEmpresas(merged);
    } catch (err: any) {
      console.error('[DEBUG] Erro na busca:', err.message);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmpresas(); }, [fetchEmpresas]);

  const filtered = useMemo(() => {
    return empresas.filter(e => 
      e.nome_fantasia?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [empresas, searchQuery]);

  return { 
    empresas: filtered, 
    isLoading, 
    isError: !!error, 
    searchQuery, 
    setSearchQuery, 
    refetch: fetchEmpresas 
  };
}
