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
      setError(null);

      // 1. Busca direta ignorando filtros
      const { data: empresasData, error: empErr } = await supabase
        .from('empresas')
        .select('id, nome_fantasia, logo_url, endereco_completo');

      if (empErr) {
        console.error('Erro na tabela empresas:', empErr);
        throw empErr;
      }

      // 2. Busca as configs (mesmo que falhe, não travamos o app)
      const { data: configs } = await supabase
        .from('config_delivery')
        .select('*');

      // 3. Mesclagem Ultra-Segura
      // Se não houver config, criamos uma "fake" ativa apenas para o restaurante aparecer
      const merged = (empresasData || []).map(empresa => {
        const configReal = configs?.find(c => c.empresa_id === empresa.id);
        return {
          ...empresa,
          config: configReal || { 
            delivery_ativo: true, 
            taxa_entrega: 0, 
            tempo_estimado_min: 30, 
            tempo_estimado_max: 60 
          }
        };
      });

      console.log('Dados carregados com sucesso:', merged);
      setEmpresas(merged);
    } catch (err: any) {
      console.error('Falha crítica no fetch:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  // Filtro de busca com proteção contra valores nulos
  const filteredEmpresas = useMemo(() => {
    if (!searchQuery) return empresas;
    const query = searchQuery.toLowerCase();
    return empresas.filter(e =>
      (e.nome_fantasia?.toLowerCase() || "").includes(query) ||
      (e.endereco_completo?.toLowerCase() || "").includes(query)
    );
  }, [empresas, searchQuery]);

  return {
    empresas: filteredEmpresas,
    isLoading,
    isError: !!error,
    searchQuery,
    setSearchQuery,
    refetch: fetchEmpresas,
  };
}
