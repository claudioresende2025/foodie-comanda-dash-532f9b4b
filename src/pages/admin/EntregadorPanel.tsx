import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Loader2, 
  Truck, 
  MapPin, 
  Phone, 
  Package, 
  CheckCircle2,
  Navigation,
  AlertCircle,
  Clock,
  User,
  Bike,
  MapPinOff,
  RefreshCw,
  Map
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DeliveryMap } from '@/components/delivery/DeliveryMap';

interface PedidoEntrega {
  id: string;
  status: string;
  total: number;
  created_at: string;
  endereco: {
    nome_cliente: string;
    telefone: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    complemento: string | null;
    referencia: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  empresa: {
    nome_fantasia: string;
  };
}

export default function EntregadorPanel() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  
  // Estados de GPS
  const [isGPSActive, setIsGPSActive] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [pedidoEmEntrega, setPedidoEmEntrega] = useState<string | null>(null);
  const [resolvedEmpresaId, setResolvedEmpresaId] = useState<string | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  
  // Ref para o watch do GPS
  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolver empresa_id: primeiro do profile, fallback via user_roles
  useEffect(() => {
    const resolveEmpresa = async () => {
      // Primeiro: tentar do profile
      if (profile?.empresa_id) {
        console.log('EntregadorPanel: empresa_id do profile:', profile.empresa_id);
        setResolvedEmpresaId(profile.empresa_id);
        return;
      }

      if (!user?.id) {
        console.log('EntregadorPanel: Nenhum user.id disponível');
        return;
      }

      // Segundo: tentar do user_roles
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (roleData?.empresa_id) {
        console.log('EntregadorPanel: empresa_id do user_roles:', roleData.empresa_id);
        setResolvedEmpresaId(roleData.empresa_id);
        return;
      }

      // Terceiro: buscar qualquer empresa que tenha o usuário como funcionário
      const { data: profileData } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData?.empresa_id) {
        console.log('EntregadorPanel: empresa_id do profiles (refetch):', profileData.empresa_id);
        setResolvedEmpresaId(profileData.empresa_id);
        return;
      }

      console.log('EntregadorPanel: Não foi possível resolver empresa_id');
    };

    resolveEmpresa();
  }, [profile?.empresa_id, user?.id]);

  // Buscar pedidos para entrega (status: confirmado, em_preparo ou saiu_entrega)
  const { data: pedidos = [], isLoading, refetch } = useQuery({
    queryKey: ['pedidos-entrega', resolvedEmpresaId],
    queryFn: async () => {
      console.log('EntregadorPanel: Buscando pedidos para empresa_id:', resolvedEmpresaId);
      
      if (!resolvedEmpresaId) {
        console.log('EntregadorPanel: empresa_id não disponível, retornando vazio');
        return [];
      }

      // DEBUG: Buscar todos os pedidos para ver os status
      const { data: allPedidos } = await supabase
        .from('pedidos_delivery')
        .select('id, status, created_at')
        .eq('empresa_id', resolvedEmpresaId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('EntregadorPanel DEBUG - Todos os pedidos recentes:', allPedidos);

      const { data, error } = await supabase
        .from('pedidos_delivery')
        .select(`
          id,
          status,
          total,
          created_at,
          endereco:enderecos_cliente(
            nome_cliente,
            telefone,
            rua,
            numero,
            bairro,
            cidade,
            estado,
            complemento,
            referencia,
            latitude,
            longitude
          ),
          empresa:empresas(nome_fantasia)
        `)
        .eq('empresa_id', resolvedEmpresaId)
        .in('status', ['confirmado', 'em_preparo', 'saiu_entrega'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('EntregadorPanel: Erro na query:', error);
        throw error;
      }

      console.log('EntregadorPanel: Pedidos para entrega:', data?.length || 0, data);

      return (data || []).map((p: any) => ({
        ...p,
        endereco: p.endereco,
        empresa: p.empresa,
      })) as PedidoEntrega[];
    },
    enabled: !!resolvedEmpresaId,
    refetchInterval: 30000,
  });

  // Mutation para atualizar status do pedido
  const updateStatusMutation = useMutation({
    mutationFn: async ({ pedidoId, newStatus }: { pedidoId: string; newStatus: 'saiu_entrega' | 'entregue' }) => {
      const { error } = await supabase
        .from('pedidos_delivery')
        .update({ status: newStatus })
        .eq('id', pedidoId);

      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-entrega'] });
      
      if (newStatus === 'saiu_entrega') {
        toast.success('Saiu para entrega! GPS ativado.');
      } else if (newStatus === 'entregue') {
        toast.success('Pedido marcado como entregue!');
      }
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // Função para enviar localização para o servidor
  const sendLocationToServer = useCallback(async (position: GeolocationPosition, pedidoId: string) => {
    try {
      const { error } = await supabase
        .from('delivery_locations')
        .upsert({
          pedido_delivery_id: pedidoId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisao: position.coords.accuracy,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'pedido_delivery_id',
        });

      if (error) {
        console.error('Erro ao enviar localização:', error);
      }
    } catch (err) {
      console.error('Erro ao enviar localização:', err);
    }
  }, []);

  // Iniciar tracking de GPS
  const startGPSTracking = useCallback((pedidoId: string) => {
    if (!navigator.geolocation) {
      toast.error('Seu navegador não suporta geolocalização');
      return false;
    }

    // Solicitar permissão e iniciar watch
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition(position);
        setGpsError(null);
        setIsGPSActive(true);
        setPedidoEmEntrega(pedidoId);

        // Enviar localização inicial
        sendLocationToServer(position, pedidoId);

        // Iniciar watch contínuo
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setCurrentPosition(pos);
            // Enviar para o servidor a cada atualização
            sendLocationToServer(pos, pedidoId);
          },
          (error) => {
            console.error('Erro no GPS:', error);
            setGpsError(error.message);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
          }
        );

        // Também enviar a cada 10 segundos como backup
        updateIntervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            (pos) => sendLocationToServer(pos, pedidoId),
            () => {},
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        }, 10000);

        toast.success('GPS ativado! Sua localização está sendo compartilhada.');
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        setGpsError(getGPSErrorMessage(error));
        toast.error(getGPSErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    return true;
  }, [sendLocationToServer]);

  // Parar tracking de GPS
  const stopGPSTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    // Remover localização final do entregador (entrega concluída)
    if (pedidoEmEntrega) {
      await supabase
        .from('delivery_locations')
        .delete()
        .eq('pedido_delivery_id', pedidoEmEntrega);
    }

    setIsGPSActive(false);
    setPedidoEmEntrega(null);
    setCurrentPosition(null);
  }, [pedidoEmEntrega]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  // Geocoding do endereço do cliente
  const geocodeDestino = useCallback(async (endereco: PedidoEntrega['endereco']) => {
    if (!endereco) return;
    
    // Se já tem coordenadas salvas, usa elas
    if (endereco.latitude && endereco.longitude) {
      setDestinoCoords({
        latitude: Number(endereco.latitude),
        longitude: Number(endereco.longitude),
      });
      setShowMap(true);
      return;
    }

    // Senão, faz geocoding
    try {
      const address = `${endereco.rua}, ${endereco.numero}, ${endereco.bairro}, ${endereco.cidade}, ${endereco.estado}, Brasil`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { 'User-Agent': 'FoodieComanda/1.0' } }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        setDestinoCoords({
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        });
        setShowMap(true);
      }
    } catch (err) {
      console.error('Erro no geocoding:', err);
    }
  }, []);

  // Inicializar mapa se já tiver pedido em entrega (caso recarregue a página)
  useEffect(() => {
    const pedidoAtivo = pedidos.find(p => p.status === 'saiu_entrega');
    if (pedidoAtivo && !showMap) {
      setPedidoEmEntrega(pedidoAtivo.id);
      if (pedidoAtivo.endereco) {
        geocodeDestino(pedidoAtivo.endereco);
      }
    }
  }, [pedidos, showMap, geocodeDestino]);

  // Handler para "Saiu para Entrega"
  const handleSaiuParaEntrega = async (pedido: PedidoEntrega) => {
    // Primeiro ativar GPS
    const gpsStarted = startGPSTracking(pedido.id);
    
    if (gpsStarted !== false) {
      // Atualizar status do pedido
      updateStatusMutation.mutate({ pedidoId: pedido.id, newStatus: 'saiu_entrega' });
      
      // Geocoding do destino para mostrar no mapa
      if (pedido.endereco) {
        geocodeDestino(pedido.endereco);
      }
    }
  };

  // Handler para "Entregue"
  const handleEntregue = async (pedidoId: string) => {
    // Parar GPS
    await stopGPSTracking();
    
    // Limpar mapa
    setDestinoCoords(null);
    setShowMap(false);
    
    // Atualizar status
    updateStatusMutation.mutate({ pedidoId, newStatus: 'entregue' });
  };

  // Função auxiliar para mensagem de erro de GPS
  const getGPSErrorMessage = (error: GeolocationPositionError): string => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Permissão de localização negada. Por favor, permita o acesso à sua localização nas configurações do navegador.';
      case error.POSITION_UNAVAILABLE:
        return 'Localização indisponível. Verifique se o GPS está ativado.';
      case error.TIMEOUT:
        return 'Tempo esgotado ao obter localização. Tente novamente.';
      default:
        return 'Erro desconhecido ao obter localização.';
    }
  };

  // Separar pedidos
  const pedidosProntos = pedidos.filter(p => p.status === 'em_preparo' || p.status === 'confirmado');
  const pedidosEmEntrega = pedidos.filter(p => p.status === 'saiu_entrega');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-2xl">
      {/* Header com status do GPS */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bike className="w-6 h-6 text-primary" />
            Painel do Entregador
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie suas entregas em tempo real
          </p>
          {resolvedEmpresaId && (
            <p className="text-xs text-muted-foreground mt-1">
              Empresa: {resolvedEmpresaId.slice(0, 8)}...
            </p>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Status do GPS */}
      <Card className={isGPSActive ? 'border-green-500 bg-green-50' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isGPSActive ? (
                <div className="relative">
                  <Navigation className="w-6 h-6 text-green-600" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
              ) : (
                <MapPinOff className="w-6 h-6 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {isGPSActive ? 'GPS Ativo' : 'GPS Inativo'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isGPSActive 
                    ? `Precisão: ${currentPosition?.coords.accuracy?.toFixed(0) || '?'}m`
                    : 'Ative o GPS para compartilhar sua localização'
                  }
                </p>
              </div>
            </div>
            {isGPSActive ? (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                Compartilhando
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error('Seu navegador não suporta geolocalização');
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setCurrentPosition(pos);
                      setGpsError(null);
                      toast.success('Permissão de GPS concedida!');
                    },
                    (err) => {
                      setGpsError(getGPSErrorMessage(err));
                      toast.error(getGPSErrorMessage(err));
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                  );
                }}
              >
                <Navigation className="w-4 h-4 mr-1" />
                Ativar GPS
              </Button>
            )}
          </div>
          {gpsError && (
            <div className="mt-3 p-2 bg-red-100 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{gpsError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pedidos em Entrega (prioridade) */}
      {pedidosEmEntrega.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            Em Entrega ({pedidosEmEntrega.length})
          </h2>
          {pedidosEmEntrega.map((pedido) => (
            <Card key={pedido.id} className="border-purple-200 bg-purple-50/50">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm text-muted-foreground">
                      #{pedido.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="font-bold text-lg text-primary">
                      R$ {pedido.total.toFixed(2)}
                    </p>
                  </div>
                  <Badge className="bg-purple-500 text-white">
                    Em Rota
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{pedido.endereco?.nome_cliente}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p>{pedido.endereco?.rua}, {pedido.endereco?.numero}</p>
                      {pedido.endereco?.complemento && (
                        <p className="text-muted-foreground">{pedido.endereco.complemento}</p>
                      )}
                      <p>{pedido.endereco?.bairro}</p>
                      {pedido.endereco?.referencia && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📍 Ref: {pedido.endereco.referencia}
                        </p>
                      )}
                    </div>
                  </div>
                  <a 
                    href={`tel:${pedido.endereco?.telefone}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    <span>{pedido.endereco?.telefone}</span>
                  </a>
                </div>

                {/* Mapa mostrando posição do entregador e destino */}
                {showMap && pedidoEmEntrega === pedido.id && (
                  <div className="rounded-xl overflow-hidden border">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-3">
                      <div className="flex items-center gap-2">
                        <Map className="w-4 h-4" />
                        <span className="font-medium text-sm">Navegação em Tempo Real</span>
                        {currentPosition && (
                          <Badge className="ml-auto bg-green-500 text-[10px]">GPS ATIVO</Badge>
                        )}
                      </div>
                    </div>
                    <DeliveryMap
                      deliveryLocation={
                        currentPosition
                          ? {
                              latitude: currentPosition.coords.latitude,
                              longitude: currentPosition.coords.longitude,
                            }
                          : null
                      }
                      customerLocation={destinoCoords}
                      restaurantLocation={null}
                      customerAddress={
                        pedido.endereco
                          ? `${pedido.endereco.rua}, ${pedido.endereco.numero} - ${pedido.endereco.bairro}`
                          : undefined
                      }
                      showRoute={true}
                    />
                  </div>
                )}

                {/* Botão para abrir no Maps */}
                {(pedido.endereco?.latitude && pedido.endereco?.longitude) || destinoCoords ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const lat = pedido.endereco?.latitude || destinoCoords?.latitude;
                      const lng = pedido.endereco?.longitude || destinoCoords?.longitude;
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Abrir no Google Maps
                  </Button>
                ) : pedido.endereco ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const address = `${pedido.endereco.rua}, ${pedido.endereco.numero}, ${pedido.endereco.bairro}, ${pedido.endereco.cidade}`;
                      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Buscar no Google Maps
                  </Button>
                ) : null}

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => handleEntregue(pedido.id)}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Confirmar Entrega
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pedidos Prontos para Sair */}
      {pedidosProntos.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            Prontos para Sair ({pedidosProntos.length})
          </h2>
          {pedidosProntos.map((pedido) => (
            <Card key={pedido.id}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm text-muted-foreground">
                      #{pedido.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="font-bold text-lg text-primary">
                      R$ {pedido.total.toFixed(2)}
                    </p>
                  </div>
                  <Badge className="bg-orange-500 text-white">
                    Pronto
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{pedido.endereco?.nome_cliente}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p>{pedido.endereco?.rua}, {pedido.endereco?.numero}</p>
                      <p>{pedido.endereco?.bairro}</p>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={() => handleSaiuParaEntrega(pedido)}
                  disabled={updateStatusMutation.isPending || (isGPSActive && pedidoEmEntrega !== pedido.id)}
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Truck className="w-4 h-4 mr-2" />
                  )}
                  Saiu para Entrega
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sem empresa vinculada */}
      {!resolvedEmpresaId && !isLoading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-red-700">Empresa não vinculada</h3>
            <p className="text-red-600 text-sm mt-2">
              Seu usuário não está vinculado a uma empresa.
              Entre em contato com o administrador.
            </p>
            <p className="text-xs text-red-500 mt-4">
              User ID: {user?.id?.slice(0, 8) || 'N/A'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sem pedidos */}
      {resolvedEmpresaId && pedidos.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Bike className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg">Nenhum pedido para entrega</h3>
            <p className="text-muted-foreground text-sm">
              Quando houver pedidos prontos, eles aparecerão aqui.
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Empresa: {resolvedEmpresaId?.slice(0, 8)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Informações de ajuda */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Como funciona
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Clique em <strong>"Saiu para Entrega"</strong> para ativar o GPS</li>
            <li>• O cliente verá sua localização em tempo real</li>
            <li>• Clique em <strong>"Confirmar Entrega"</strong> ao finalizar</li>
            <li>• Mantenha o celular com boa conexão de internet</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
