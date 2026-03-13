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
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
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

  // Buscar nome da empresa quando empresa_id for resolvido
  useEffect(() => {
    const fetchEmpresaNome = async () => {
      if (!resolvedEmpresaId) return;
      
      const { data } = await supabase
        .from('empresas')
        .select('nome_fantasia')
        .eq('id', resolvedEmpresaId)
        .maybeSingle();
      
      if (data?.nome_fantasia) {
        setEmpresaNome(data.nome_fantasia);
      }
    };

    fetchEmpresaNome();
  }, [resolvedEmpresaId]);

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
            referencia
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
  // Agora salva em entregador_locations (global) em vez de delivery_locations (por pedido)
  const sendLocationToServer = useCallback(async (position: GeolocationPosition) => {
    if (!resolvedEmpresaId || !user?.id) {
      console.log('Não é possível salvar localização: empresa ou user não disponível');
      return;
    }

    try {
      console.log('Enviando localização global do entregador:', {
        userId: user.id,
        empresaId: resolvedEmpresaId,
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });

      // Salvar em entregador_locations (GPS global do entregador)
      const { data: existingData, error: selectError } = await supabase
        .from('entregador_locations')
        .select('id')
        .eq('user_id', user.id)
        .eq('empresa_id', resolvedEmpresaId)
        .maybeSingle();

      if (selectError) {
        console.error('Erro ao buscar localização existente:', selectError);
      }

      let error;
      if (existingData) {
        // Já existe, fazer UPDATE
        const result = await supabase
          .from('entregador_locations')
          .update({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            precisao: position.coords.accuracy,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('empresa_id', resolvedEmpresaId);
        error = result.error;
      } else {
        // Não existe, fazer INSERT
        const result = await supabase
          .from('entregador_locations')
          .insert({
            user_id: user.id,
            empresa_id: resolvedEmpresaId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            precisao: position.coords.accuracy,
            is_active: true,
          });
        error = result.error;
      }

      if (error) {
        console.error('Erro ao salvar localização do entregador:', error);
        // Fallback: tentar salvar diretamente em delivery_locations para pedidos ativos
        await syncLocationToPedidos(position);
      } else {
        console.log('Localização do entregador salva com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao enviar localização:', err);
    }
  }, [resolvedEmpresaId, user?.id]);

  // Função para sincronizar localização manualmente com todos os pedidos ativos
  const syncLocationToPedidos = useCallback(async (position: GeolocationPosition) => {
    if (!resolvedEmpresaId || !user?.id) return;

    try {
      // Buscar todos os pedidos do entregador com status "saiu_entrega"
      const { data: pedidosAtivos } = await supabase
        .from('pedidos_delivery')
        .select('id')
        .eq('empresa_id', resolvedEmpresaId)
        .eq('entregador_id', user.id)
        .eq('status', 'saiu_entrega');

      if (!pedidosAtivos || pedidosAtivos.length === 0) return;

      console.log(`Sincronizando localização para ${pedidosAtivos.length} pedidos ativos`);

      // Atualizar delivery_locations para cada pedido
      for (const pedido of pedidosAtivos) {
        const { data: existingLoc } = await supabase
          .from('delivery_locations')
          .select('id')
          .eq('pedido_delivery_id', pedido.id)
          .maybeSingle();

        if (existingLoc) {
          await supabase
            .from('delivery_locations')
            .update({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              precisao: position.coords.accuracy,
              updated_at: new Date().toISOString(),
            })
            .eq('pedido_delivery_id', pedido.id);
        } else {
          await supabase
            .from('delivery_locations')
            .insert({
              pedido_delivery_id: pedido.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              precisao: position.coords.accuracy,
            });
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar localização com pedidos:', err);
    }
  }, [resolvedEmpresaId, user?.id]);

  // Iniciar tracking de GPS (global - não vinculado a um pedido específico)
  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Seu navegador não suporta geolocalização');
      return false;
    }

    if (!resolvedEmpresaId || !user?.id) {
      toast.error('Empresa ou usuário não identificado');
      return false;
    }

    // Função para iniciar o watch após obter posição inicial
    const startWatch = (initialPosition?: GeolocationPosition) => {
      if (initialPosition) {
        setCurrentPosition(initialPosition);
        sendLocationToServer(initialPosition);
      }
      
      setGpsError(null);
      setIsGPSActive(true);

      // Iniciar watch contínuo - mais tolerante a erros
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setCurrentPosition(pos);
          setGpsError(null); // Limpar erro anterior
          // Enviar para o servidor a cada atualização
          sendLocationToServer(pos);
        },
        (error) => {
          console.error('Erro no GPS watch:', error);
          // Não mostrar erro de timeout no watch, apenas logar
          if (error.code !== error.TIMEOUT) {
            setGpsError(error.message);
          }
        },
        {
          enableHighAccuracy: false, // Menos preciso mas mais rápido
          timeout: 30000, // 30 segundos
          maximumAge: 10000, // Aceita posição de até 10 segundos atrás
        }
      );

      // Também enviar a cada 15 segundos como backup
      updateIntervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCurrentPosition(pos);
            setGpsError(null);
            sendLocationToServer(pos);
          },
          () => {}, // Ignorar erros no backup
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 15000 }
        );
      }, 15000);

      toast.success('GPS ativado! Sua localização está sendo compartilhada para todas as entregas.');
    };

    // Tentar obter posição inicial - com alta tolerância
    navigator.geolocation.getCurrentPosition(
      (position) => {
        startWatch(position);
      },
      (error) => {
        console.error('Erro ao obter localização inicial:', error);
        // Mesmo com erro, iniciar o watch - pode funcionar depois
        if (error.code === error.TIMEOUT) {
          toast.warning('GPS demorando... Tentando novamente automaticamente.');
          startWatch(); // Iniciar watch mesmo sem posição inicial
        } else {
          setGpsError(getGPSErrorMessage(error));
          toast.error(getGPSErrorMessage(error));
        }
      },
      {
        enableHighAccuracy: false, // Menos preciso mas mais rápido no celular
        timeout: 30000, // 30 segundos - mais tolerante
        maximumAge: 30000, // Aceita posição de até 30 segundos atrás
      }
    );

    return true;
  }, [sendLocationToServer, resolvedEmpresaId, user?.id]);

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

    // Desativar localização do entregador (não deletar, apenas marcar como inativo)
    if (resolvedEmpresaId && user?.id) {
      await supabase
        .from('entregador_locations')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('empresa_id', resolvedEmpresaId);
    }

    setIsGPSActive(false);
    setPedidoEmEntrega(null);
    setCurrentPosition(null);
  }, [resolvedEmpresaId, user?.id]);

  // Verificar se o GPS já estava ativo ao carregar a página (persistência de estado)
  useEffect(() => {
    const checkAndRestoreGPS = async () => {
      if (!resolvedEmpresaId || !user?.id) return;

      try {
        // Verificar se existe um registro ativo de GPS para este entregador
        const { data } = await supabase
          .from('entregador_locations')
          .select('is_active, latitude, longitude, updated_at')
          .eq('user_id', user.id)
          .eq('empresa_id', resolvedEmpresaId)
          .maybeSingle();

        // Se o GPS estava marcado como ativo (menos de 5 minutos atrás), restaurar
        if (data?.is_active) {
          const updatedAt = new Date(data.updated_at);
          const now = new Date();
          const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000 / 60;
          
          // Se foi atualizado nos últimos 5 minutos, considerar como ainda ativo
          if (minutesSinceUpdate < 5) {
            console.log('Restaurando GPS do entregador - estava ativo há', minutesSinceUpdate.toFixed(1), 'minutos');
            // Reiniciar o tracking automaticamente
            startGPSTracking();
          } else {
            console.log('GPS estava ativo mas há mais de 5 minutos sem atualização. Marcando como inativo.');
            // Marcar como inativo no banco
            await supabase
              .from('entregador_locations')
              .update({ is_active: false })
              .eq('user_id', user.id)
              .eq('empresa_id', resolvedEmpresaId);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar estado do GPS:', err);
      }
    };

    // Só executar após ter os IDs necessários
    if (resolvedEmpresaId && user?.id) {
      checkAndRestoreGPS();
    }
  }, [resolvedEmpresaId, user?.id, startGPSTracking]);

  // Cleanup ao desmontar - NÃO desativar no banco, apenas parar o watch local
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      // Não marcar como inativo no banco - queremos manter o estado para quando voltar
    };
  }, []);

  // Geocoding do endereço do cliente
  const geocodeDestino = useCallback(async (endereco: PedidoEntrega['endereco']) => {
    if (!endereco) return;
    
    // Fazer geocoding do endereço
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
    if (pedidoAtivo) {
      setPedidoEmEntrega(pedidoAtivo.id);
      // Sempre fazer geocoding do endereço do pedido ativo
      if (pedidoAtivo.endereco && !destinoCoords) {
        geocodeDestino(pedidoAtivo.endereco);
      }
    }
  }, [pedidos, geocodeDestino, destinoCoords]);

  // Handler para "Saiu para Entrega"
  const handleSaiuParaEntrega = async (pedido: PedidoEntrega) => {
    if (!user?.id) {
      toast.error('Usuário não identificado');
      return;
    }

    // Primeiro: vincular o entregador ao pedido
    const { error: updateError } = await supabase
      .from('pedidos_delivery')
      .update({ entregador_id: user.id })
      .eq('id', pedido.id);

    if (updateError) {
      console.error('Erro ao vincular entregador:', updateError);
      toast.error('Erro ao vincular entregador ao pedido');
      return;
    }

    // Segundo: ativar GPS se ainda não estiver ativo
    if (!isGPSActive) {
      const gpsStarted = startGPSTracking();
      if (gpsStarted === false) {
        toast.warning('GPS não disponível, mas o pedido será marcado como saiu para entrega');
      }
    }
    
    // Terceiro: criar entrada em delivery_locations para esse pedido
    if (currentPosition) {
      await supabase
        .from('delivery_locations')
        .upsert({
          pedido_delivery_id: pedido.id,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          precisao: currentPosition.coords.accuracy,
        }, { onConflict: 'pedido_delivery_id' });
    }

    // Atualizar status do pedido
    updateStatusMutation.mutate({ pedidoId: pedido.id, newStatus: 'saiu_entrega' });
    setPedidoEmEntrega(pedido.id);
    
    // Geocoding do destino para mostrar no mapa
    if (pedido.endereco) {
      geocodeDestino(pedido.endereco);
    }
  };

  // Handler para "Entregue"
  const handleEntregue = async (pedidoId: string) => {
    // Remover a localização deste pedido específico
    await supabase
      .from('delivery_locations')
      .delete()
      .eq('pedido_delivery_id', pedidoId);
    
    // Limpar mapa se era o pedido em exibição
    if (pedidoEmEntrega === pedidoId) {
      setDestinoCoords(null);
      setShowMap(false);
      setPedidoEmEntrega(null);
    }
    
    // Atualizar status
    updateStatusMutation.mutate({ pedidoId, newStatus: 'entregue' });

    // Verificar se ainda há pedidos em entrega
    const pedidosRestantes = pedidos.filter(p => p.status === 'saiu_entrega' && p.id !== pedidoId);
    
    if (pedidosRestantes.length === 0) {
      // Se não há mais pedidos em entrega, perguntar se quer desativar GPS
      toast.info('Última entrega! GPS ainda ativo para próximas entregas.');
    } else {
      // Se há mais pedidos, mostra o próximo no mapa
      const proximoPedido = pedidosRestantes[0];
      setPedidoEmEntrega(proximoPedido.id);
      if (proximoPedido.endereco) {
        geocodeDestino(proximoPedido.endereco);
      }
      toast.success(`Entrega confirmada! ${pedidosRestantes.length} entrega(s) restante(s).`);
    }
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
          {empresaNome && (
            <p className="text-xs text-muted-foreground mt-1">
              {empresaNome}
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
                variant="default"
                className="bg-primary"
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error('Seu navegador não suporta geolocalização');
                    return;
                  }
                  toast.info('Obtendo localização... Aguarde.');
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setCurrentPosition(pos);
                      setGpsError(null);
                      setIsGPSActive(true);
                      toast.success('GPS ativado com sucesso!');
                    },
                    (err) => {
                      // Mesmo com erro, tentar iniciar watch
                      if (err.code === err.TIMEOUT) {
                        toast.warning('GPS demorando... Tentando método alternativo.');
                        // Tentar com configurações mais tolerantes
                        navigator.geolocation.getCurrentPosition(
                          (pos2) => {
                            setCurrentPosition(pos2);
                            setGpsError(null);
                            setIsGPSActive(true);
                            toast.success('GPS ativado!');
                          },
                          () => {
                            setGpsError('Não foi possível obter localização. Verifique se o GPS está ativado.');
                            toast.error('Não foi possível obter localização. Ative o GPS nas configurações.');
                          },
                          { enableHighAccuracy: false, timeout: 60000, maximumAge: 60000 }
                        );
                      } else {
                        setGpsError(getGPSErrorMessage(err));
                        toast.error(getGPSErrorMessage(err));
                      }
                    },
                    { enableHighAccuracy: false, timeout: 30000, maximumAge: 30000 }
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
                {(showMap || destinoCoords) && (
                  <div className="rounded-xl overflow-hidden border relative" style={{ zIndex: 0 }}>
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-3">
                      <div className="flex items-center gap-2">
                        <Map className="w-4 h-4" />
                        <span className="font-medium text-sm">Navegação em Tempo Real</span>
                        {currentPosition ? (
                          <Badge className="ml-auto bg-green-500 text-[10px]">GPS ATIVO</Badge>
                        ) : (
                          <Badge className="ml-auto bg-yellow-500 text-[10px]">AGUARDANDO GPS</Badge>
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
                {destinoCoords ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${destinoCoords.latitude},${destinoCoords.longitude}`;
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
                  disabled={updateStatusMutation.isPending}
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
