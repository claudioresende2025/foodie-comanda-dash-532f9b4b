import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDeliveryRestaurants() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchEmpresas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Busca as empresas
      const { data: empresasData, error: empErr } = await supabase
        .from('empresas')
        .select('*');

      if (empErr) throw empErr;

      // 2. Busca as configurações de delivery ativas
      // A RLS já filtra apenas delivery_ativo = true para usuários públicos
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
            delivery_ativo: false, 
            taxa_entrega: 0,
            tempo_estimado_min: 30,
            tempo_estimado_max: 60,
            icon: 'Store'
          }
        };
      }).filter(e => e.config.delivery_ativo === true);

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

    // Subscription para mudanças em config_delivery (realtime)
    // Quando admin ativa/desativa delivery, a lista atualiza automaticamente
    subscriptionRef.current = supabase
      .channel('config_delivery_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'config_delivery',
        },
        (payload) => {
          console.log('[useDeliveryRestaurants] config_delivery changed:', payload);
          // Refetch quando houver mudanças no config_delivery
          fetchEmpresas();
        }
      )
      .subscribe();

    return () => {
      // Cleanup subscription on unmount
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
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
