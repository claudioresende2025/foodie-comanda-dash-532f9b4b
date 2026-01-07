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

      // 1. Busca as empresas
      const { data: empresasData, error: empErr } = await supabase
        .from('empresas')
        .select('*');

      if (empErr) throw empErr;

      // 2. Busca as configurações
      const { data: configs } = await supabase
        .from('config_delivery')
        .select('*');

      // 3. Mesclagem com OBJETOS PADRÃO (Default Objects)
      // O erro de "icon" acontece aqui: se a config não existe, 
      // precisamos passar um objeto vazio em vez de undefined.
      const merged = (empresasData || []).map(empresa => {
        const configReal = configs?.find(c => c.empresa_id === empresa.id);
        
        return {
          ...empresa,
          // Se não tiver nome_fantasia, usamos um texto padrão para não quebrar a busca
          nome_fantasia: empresa.nome_fantasia || "Restaurante sem nome",
          // Se não tiver config, criamos um objeto com valores padrão
          config: configReal || { 
            delivery_ativo: true, 
            taxa_entrega: 0,
            tempo_estimado_min: 30,
            tempo_estimado_max: 60,
            icon: 'Store' // Valor padrão para evitar o erro de 'reading icon'
          }
        };
      });

      setEmpresas(merged);
    } catch (err: any) {
      console.error('Erro ao carregar restaurantes:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  const filteredEmpresas = useMemo(() => {
    const lista = empresas || [];
    if (!searchQuery) return lista;
    
    const query = searchQuery.toLowerCase();
    return lista.filter(e =>
      (e.nome_fantasia?.toLowerCase() || "").includes(query)
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
