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
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const fetchLocation = useCallback(async () => {
    if (!pedidoId) {
      setIsLoading(false);
      return;
    }

    try {
      // Primeiro: buscar localização da tabela delivery_locations (sincronizada pelo trigger)
      const { data, error } = await supabase
        .from('delivery_locations')
        .select('*')
        .eq('pedido_delivery_id', pedidoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && data.latitude && data.longitude) {
        setLocation({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          updated_at: data.updated_at,
          precisao: data.precisao ? Number(data.precisao) : undefined,
        });
        setHasLocation(true);
        setIsLoading(false);
        return;
      }

      // Segundo: se não encontrou, tentar buscar diretamente de entregador_locations
      // Primeiro pegar o entregador_id do pedido
      const { data: pedidoData } = await supabase
        .from('pedidos_delivery')
        .select('entregador_id, empresa_id')
        .eq('id', pedidoId)
        .maybeSingle();

      if (pedidoData?.entregador_id && pedidoData?.empresa_id) {
        setEntregadorId(pedidoData.entregador_id);
        setEmpresaId(pedidoData.empresa_id);

        const { data: entregadorLoc } = await supabase
          .from('entregador_locations')
          .select('*')
          .eq('user_id', pedidoData.entregador_id)
          .eq('empresa_id', pedidoData.empresa_id)
          .eq('is_active', true)
          .maybeSingle();

        if (entregadorLoc && entregadorLoc.latitude && entregadorLoc.longitude) {
          setLocation({
            latitude: Number(entregadorLoc.latitude),
            longitude: Number(entregadorLoc.longitude),
            updated_at: entregadorLoc.updated_at,
            precisao: entregadorLoc.precisao ? Number(entregadorLoc.precisao) : undefined,
          });
          setHasLocation(true);
          setIsLoading(false);
          return;
        }
      }

      setHasLocation(false);
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

  // Realtime subscription para atualizações de localização em delivery_locations
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

  // Realtime subscription para atualizações diretas de entregador_locations
  useEffect(() => {
    if (!entregadorId || !empresaId) return;

    const channel = supabase
      .channel(`entregador-tracking-${entregadorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entregador_locations',
          filter: `user_id=eq.${entregadorId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const newData = payload.new as {
              latitude: number;
              longitude: number;
              updated_at: string;
              precisao: number | null;
              is_active: boolean;
            };
            if (newData.is_active && newData.latitude && newData.longitude) {
              setLocation({
                latitude: Number(newData.latitude),
                longitude: Number(newData.longitude),
                updated_at: newData.updated_at,
                precisao: newData.precisao ? Number(newData.precisao) : undefined,
              });
              setHasLocation(true);
            } else if (!newData.is_active) {
              setHasLocation(false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entregadorId, empresaId]);

  return { location, hasLocation, isLoading, refetch: fetchLocation };
}
