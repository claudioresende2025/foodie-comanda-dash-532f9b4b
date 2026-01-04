import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryLocation {
  latitude: number;
  longitude: number;
  updated_at: string;
  precisao?: number;
}

interface DeliveryLocationRow {
  id: string;
  pedido_delivery_id: string;
  latitude: number;
  longitude: number;
  precisao: number | null;
  created_at: string;
  updated_at: string;
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
      // Buscar localização do motoboy usando query direta com cast
      const { data, error } = await (supabase
        .from('delivery_locations' as any)
        .select('*')
        .eq('pedido_delivery_id', pedidoId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any);

      if (error) {
        console.log('Tabela delivery_locations não disponível:', error.message);
        setHasLocation(false);
        setIsLoading(false);
        return;
      }

      if (data) {
        const row = data as DeliveryLocationRow;
        setLocation({
          latitude: row.latitude,
          longitude: row.longitude,
          updated_at: row.updated_at,
          precisao: row.precisao || undefined,
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
      .channel(`delivery-location-${pedidoId}`)
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
            const newData = payload.new as DeliveryLocationRow;
            setLocation({
              latitude: newData.latitude,
              longitude: newData.longitude,
              updated_at: newData.updated_at,
              precisao: newData.precisao || undefined,
            });
            setHasLocation(true);
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
