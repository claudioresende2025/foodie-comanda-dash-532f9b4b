import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryLocation {
  latitude: number;
  longitude: number;
  updated_at: string;
  precisao?: number;
  status?: string;
  observacao?: string;
}

interface DeliveryTrackingRow {
  id: string;
  pedido_delivery_id: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
  observacao: string | null;
  created_at: string;
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
      // Buscar localização usando a tabela delivery_tracking
      const { data, error } = await supabase
        .from('delivery_tracking')
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
        const row = data as DeliveryTrackingRow;
        setLocation({
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          updated_at: row.created_at,
          precisao: row.precisao ? Number(row.precisao) : undefined,
          status: row.status,
          observacao: row.observacao || undefined,
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
          table: 'delivery_tracking',
          filter: `pedido_delivery_id=eq.${pedidoId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const newData = payload.new as DeliveryTrackingRow;
            if (newData.latitude && newData.longitude) {
              setLocation({
                latitude: Number(newData.latitude),
                longitude: Number(newData.longitude),
                updated_at: newData.created_at,
                precisao: newData.precisao ? Number(newData.precisao) : undefined,
                status: newData.status,
                observacao: newData.observacao || undefined,
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
