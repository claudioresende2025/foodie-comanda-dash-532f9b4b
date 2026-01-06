import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryLocation {
  latitude: number;
  longitude: number;
  updated_at: string;
  precisao?: number;
}

export function useDeliveryTracking(pedidoId: string | undefined) {
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLocation = useCallback(async () => {
    if (!pedidoId) {
      setIsLoading(false);
      return;
    }

    try {
      // Buscar localização usando a tabela delivery_locations
      const { data, error } = await supabase
        .from('delivery_locations')
        .select('*')
        .eq('pedido_delivery_id', pedidoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log('Erro ao buscar tracking:', error.message);
        setHasLocation(false);
        setIsLoading(false);
        return;
      }

      if (data && data.latitude && data.longitude) {
        setLocation({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          updated_at: data.updated_at,
          precisao: data.precisao ? Number(data.precisao) : undefined,
        });
        setHasLocation(true);
      } else {
        setHasLocation(false);
      }
    } catch (err) {
      console.error('Erro ao buscar localização:', err);
      setHasLocation(false);
    } finally {
      setIsLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // Realtime subscription para atualizações de localização
  useEffect(() => {
    if (!pedidoId) return;

    const channel = supabase
      .channel(`delivery-tracking-${pedidoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_locations',
          filter: `pedido_delivery_id=eq.${pedidoId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const newData = payload.new as {
              latitude: number;
              longitude: number;
              updated_at: string;
              precisao: number | null;
            };
            if (newData.latitude && newData.longitude) {
              setLocation({
                latitude: Number(newData.latitude),
                longitude: Number(newData.longitude),
                updated_at: newData.updated_at,
                precisao: newData.precisao ? Number(newData.precisao) : undefined,
              });
              setHasLocation(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedidoId]);

  return { location, hasLocation, isLoading, refetch: fetchLocation };
}
