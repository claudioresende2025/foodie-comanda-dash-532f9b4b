import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { printKitchenOrder } from "@/utils/kitchenPrinter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Clock, ChefHat, CheckCircle, Truck, XCircle, Loader2, RefreshCw, BellRing, Check, Bell } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ChamadaGarcom = {
  id: string;
  mesa_id: string;
  status: string;
  created_at: string;
};

type Mesa = {
  id: string;
  numero_mesa: number;
  nome?: string | null;
};

type PedidoStatus = Database["public"]["Enums"]["pedido_status"];

const statusConfig: Record<PedidoStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500", icon: Clock },
  preparando: { label: "Preparando", color: "bg-blue-500", icon: ChefHat },
  pronto: { label: "Pronto", color: "bg-green-500", icon: CheckCircle },
  entregue: { label: "Entregue", color: "bg-gray-500", icon: Truck },
  cancelado: { label: "Cancelado", color: "bg-red-500", icon: XCircle },
};

// MAPEAMENTO REAL → LABEL TABS
const statusMap = {
  pendente: "pendente",
  preparando: "preparando",
  pronto: "pronto",
  entregue: "entregue",
  cancelado: "cancelado",
};

// Som de notificação mais chamativo (múltiplos beeps)
const playNotificationSound = () => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();

    const beep = (freq: number, durMs: number, delay: number = 0) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const startTime = audioContext.currentTime + delay;
      gain.gain.setValueAtTime(0.5, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + durMs / 1000);
      osc.start(startTime);
      osc.stop(startTime + durMs / 1000);
    };

    // Sequência de beeps para chamar atenção
    beep(880, 150, 0);
    beep(1100, 150, 0.2);
    beep(880, 150, 0.4);
    beep(1100, 200, 0.6);
  } catch (e) {
    console.log("Audio not supported:", e);
  }
};

// ===============================
// TEMPO DE PREPARO DINÂMICO (em milissegundos)
// Baseado no nome do produto e/ou categoria
// ===============================
const getTempoPreparoMs = (nomeProduto?: string, nomeCategoria?: string): number => {
  const produto = (nomeProduto || "").toLowerCase();
  const categoria = (nomeCategoria || "").toLowerCase();

  // Bebidas rápidas - 1 minuto (60.000ms)
  if (
    categoria.includes("bebida") ||
    categoria.includes("drink") ||
    produto.includes("água") ||
    produto.includes("refrigerante") ||
    produto.includes("suco") ||
    produto.includes("cerveja") ||
    produto.includes("chopp")
  ) {
    return 60 * 1000; // 1 minuto
  }

  // Café e bebidas quentes - 3 minutos (180.000ms)
  if (
    produto.includes("café") ||
    produto.includes("cappuccino") ||
    produto.includes("chocolate quente") ||
    produto.includes("chá")
  ) {
    return 3 * 60 * 1000; // 3 minutos
  }

  // Sobremesas - 5 minutos (300.000ms)
  if (
    categoria.includes("sobremesa") ||
    categoria.includes("doce") ||
    produto.includes("sorvete") ||
    produto.includes("pudim") ||
    produto.includes("torta")
  ) {
    return 5 * 60 * 1000; // 5 minutos
  }

  // Lanches e sanduíches - 8 minutos (480.000ms)
  if (
    categoria.includes("lanche") ||
    categoria.includes("sanduíche") ||
    categoria.includes("hamburguer") ||
    categoria.includes("burger") ||
    produto.includes("hamburguer") ||
    produto.includes("burger") ||
    produto.includes("x-") ||
    produto.includes("hot dog")
  ) {
    return 8 * 60 * 1000; // 8 minutos
  }

  // Porções e petiscos - 10 minutos (600.000ms)
  if (
    categoria.includes("porção") ||
    categoria.includes("porções") ||
    categoria.includes("petisco") ||
    categoria.includes("entrada") ||
    produto.includes("batata frita") ||
    produto.includes("onion") ||
    produto.includes("isca")
  ) {
    return 10 * 60 * 1000; // 10 minutos
  }

  // Pratos principais / refeições - 15 minutos (900.000ms)
  if (
    categoria.includes("prato") ||
    categoria.includes("refeição") ||
    categoria.includes("almoço") ||
    categoria.includes("jantar") ||
    produto.includes("arroz") ||
    produto.includes("feijão") ||
    produto.includes("bife") ||
    produto.includes("filé") ||
    produto.includes("frango")
  ) {
    return 15 * 60 * 1000; // 15 minutos
  }

  // Pizzas e massas - 20 minutos (1.200.000ms)
  if (
    categoria.includes("pizza") ||
    categoria.includes("massa") ||
    produto.includes("pizza") ||
    produto.includes("lasanha") ||
    produto.includes("macarrão") ||
    produto.includes("espaguete")
  ) {
    return 20 * 60 * 1000; // 20 minutos
  }

  // Default: 5 minutos para itens não identificados
  return 5 * 60 * 1000; // 5 minutos
};

export default function Pedidos() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PedidoStatus>("preparando"); // Iniciar em "preparando" já que pendentes são auto-movidos
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedPedidosRef = useRef<Set<string>>(new Set()); // Evitar processar o mesmo pedido múltiplas vezes

  // ===============================
  // QUERY ÚNICA → SUPER PERFORMÁTICA
  // ===============================
  const {
    data: pedidos,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["pedidos-kds", profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];

      const { data, error } = await supabase
        .from("pedidos")
        .select(
          `
          *,
          produto:produtos(nome, preco, categoria:categorias(nome)),
          comanda:comandas!inner(
            id,
            nome_cliente,
            empresa_id,
            mesa:mesas(numero_mesa)
          )
        `,
        )
        .eq("comanda.empresa_id", profile.empresa_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.empresa_id,
    staleTime: 3000,
    refetchInterval: 8000,
  });

  // Query para chamadas de garçom pendentes
  const { data: chamadas = [] } = useQuery<ChamadaGarcom[]>({
    queryKey: ["chamadas-garcom-kds", profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from("chamadas_garcom")
        .select("id, mesa_id, status, created_at")
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.empresa_id,
    refetchInterval: 5000,
  });

  // Query para mesas (para exibir nome/número)
  const { data: mesas = [] } = useQuery<Mesa[]>({
    queryKey: ["mesas-kds", profile?.empresa_id],
    queryFn: async () => {
      if (!profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from("mesas")
        .select("id, numero_mesa, nome")
        .eq("empresa_id", profile.empresa_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.empresa_id,
  });

  // Helper para obter nome/número da mesa
  const getMesaDisplayName = (mesaId: string) => {
    const mesa = mesas.find((m) => m.id === mesaId);
    if (!mesa) return "Mesa";
    return mesa.nome || `Mesa ${mesa.numero_mesa}`;
  };

  // ===============================
  // AUTO-ATUALIZAÇÃO DE STATUS DOS PEDIDOS
  // Pendente → Preparando (automático imediato)
  // Preparando → Pronto (automático após tempo de preparo dinâmico)
  // Pronto → Entregue (manual pelo garçom)
  // ===============================
  useEffect(() => {
    if (!pedidos || pedidos.length === 0 || !profile?.empresa_id) return;

    const autoUpdatePedidos = async () => {
      for (const pedido of pedidos) {
        const pedidoId = pedido.id;
        const statusAtual = pedido.status_cozinha as PedidoStatus;
        
        // Evitar processar pedidos já processados
        if (processedPedidosRef.current.has(`${pedidoId}-${statusAtual}`)) continue;

        // Pendente → Preparando (imediato)
        if (statusAtual === "pendente") {
          processedPedidosRef.current.add(`${pedidoId}-pendente`);
          
          try {
            const { error } = await supabase
              .from("pedidos")
              .update({ status_cozinha: "preparando" })
              .eq("id", pedidoId);
            
            if (!error) {
              console.log(`[KDS] Pedido ${pedidoId} movido: pendente → preparando`);
              queryClient.invalidateQueries({ queryKey: ["pedidos-kds", profile.empresa_id] });
            }
          } catch (e) {
            console.error("Erro ao auto-atualizar pendente → preparando:", e);
          }
        }
        
        // Preparando → Pronto (após tempo de preparo dinâmico baseado no produto)
        if (statusAtual === "preparando") {
          const alreadyScheduled = processedPedidosRef.current.has(`${pedidoId}-preparando`);
          if (!alreadyScheduled) {
            processedPedidosRef.current.add(`${pedidoId}-preparando`);
            
            // Calcular tempo de preparo baseado no produto e categoria
            const nomeProduto = (pedido as any).produto?.nome;
            const nomeCategoria = (pedido as any).produto?.categoria?.nome;
            const tempoPreparo = getTempoPreparoMs(nomeProduto, nomeCategoria);
            const tempoMinutos = Math.round(tempoPreparo / 60000);
            
            console.log(`[KDS] Pedido ${pedidoId} (${nomeProduto || 'item'}) - Tempo de preparo: ${tempoMinutos} min`);
            
            setTimeout(async () => {
              try {
                // Verificar se ainda está "preparando" antes de atualizar
                const { data: pedidoAtual } = await supabase
                  .from("pedidos")
                  .select("status_cozinha")
                  .eq("id", pedidoId)
                  .single();
                
                if (pedidoAtual?.status_cozinha === "preparando") {
                  const { error } = await supabase
                    .from("pedidos")
                    .update({ status_cozinha: "pronto" })
                    .eq("id", pedidoId);
                  
                  if (!error) {
                    console.log(`[KDS] Pedido ${pedidoId} movido: preparando → pronto`);
                    queryClient.invalidateQueries({ queryKey: ["pedidos-kds", profile.empresa_id] });
                    playNotificationSound(); // Tocar som quando pronto
                    toast.success(`✅ ${nomeProduto || 'Pedido'} pronto para entrega!`, { duration: 4000 });
                  }
                }
              } catch (e) {
                console.error("Erro ao auto-atualizar preparando → pronto:", e);
              }
            }, tempoPreparo); // Tempo dinâmico baseado no tipo de produto
          }
        }
      }
    };

    autoUpdatePedidos();
  }, [pedidos, profile?.empresa_id, queryClient]);

  // ===============================
  // SOM CONTÍNUO PARA CHAMADAS PENDENTES
  // ===============================
  useEffect(() => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }

    if (chamadas.length > 0 && soundEnabled) {
      playNotificationSound();
      soundIntervalRef.current = setInterval(() => {
        playNotificationSound();
      }, 5000);
    }

    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    };
  }, [chamadas.length, soundEnabled]);

  // ===============================
  // REALTIME
  // ===============================
  useEffect(() => {
    if (!profile?.empresa_id) return;

    const channelPedidos = supabase
      .channel("kds-pedidos")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pedidos",
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["pedidos-kds", profile.empresa_id] });

          if (payload.eventType === "INSERT") {
            playNotificationSound();
            toast.info("🍽️ Novo pedido recebido!", { duration: 5000 });
          }
        },
      )
      .subscribe();

    const channelChamadas = supabase
      .channel("kds-chamadas")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chamadas_garcom",
          filter: `empresa_id=eq.${profile.empresa_id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["chamadas-garcom-kds", profile.empresa_id] });

          if (payload.eventType === "INSERT") {
            if (soundEnabled) playNotificationSound();
            toast.info("🔔 Chamada de garçom recebida!", { duration: 5000 });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelPedidos);
      supabase.removeChannel(channelChamadas);
    };
  }, [profile?.empresa_id, queryClient, soundEnabled]);

  // ===============================
  // UPDATE STATUS
  // ===============================
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PedidoStatus }) => {
      const { error } = await supabase.from("pedidos").update({ status_cozinha: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-kds", profile?.empresa_id] });
      toast.success("Status atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  // Handler para atender chamada de garçom
  const handleAtenderChamada = async (chamadaId: string) => {
    const { error } = await supabase
      .from("chamadas_garcom")
      .update({ status: "atendida", atendida_at: new Date().toISOString() })
      .eq("id", chamadaId);

    if (error) {
      toast.error("Erro ao atender chamada");
    } else {
      toast.success("Chamada atendida!");
      queryClient.invalidateQueries({ queryKey: ["chamadas-garcom-kds", profile?.empresa_id] });
      queryClient.invalidateQueries({ queryKey: ["chamadas-garcom", profile?.empresa_id] }); // Sincronizar com página Garçom
    }
  };

  const getNextStatus = (current: PedidoStatus): PedidoStatus | null => {
    const flow: Record<PedidoStatus, PedidoStatus | null> = {
      pendente: "preparando",
      preparando: "pronto",
      pronto: "entregue",
      entregue: null,
      cancelado: null,
    };
    return flow[current];
  };

  // ===============================
  // FILTRO CORRIGIDO + COM useMemo (PERFORMANCE)
  // ===============================
  const filteredPedidos = useMemo(() => {
    return pedidos?.filter((p) => p.status_cozinha === activeTab) || [];
  }, [pedidos, activeTab]);

  const countByStatus = (status: PedidoStatus) => pedidos?.filter((p) => p.status_cozinha === status).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header responsivo para mobile */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">KDS - Cozinha</h1>
          <p className="text-muted-foreground mt-1">Gerencie os pedidos da cozinha</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={soundEnabled ? "default" : "outline"}
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex-1 sm:flex-none"
          >
            {soundEnabled ? <Bell className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2 opacity-50" />}
            Som {soundEnabled ? "Ativado" : "Desativado"}
          </Button>
          <Button variant="outline" onClick={() => refetch()} className="flex-1 sm:flex-none">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Chamadas Pendentes */}
      {chamadas.length > 0 && (
        <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30 animate-pulse">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <BellRing className="w-5 h-5" />
              Chamadas Pendentes ({chamadas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {chamadas.map((chamada) => {
                const displayName = getMesaDisplayName(chamada.mesa_id);
                return (
                  <Button
                    key={chamada.id}
                    variant="destructive"
                    className="h-20 flex flex-col gap-1"
                    onClick={() => handleAtenderChamada(chamada.id)}
                    title={`Atender ${displayName}`}
                  >
                    <span className="text-lg font-bold">{displayName}</span>
                    <span className="text-xs flex items-center gap-1">
                      <Check className="w-3 h-3" /> Atender
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PedidoStatus)}>
        <TabsList className="grid w-full grid-cols-5 h-auto">
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = countByStatus(status as PedidoStatus);
            return (
              <TabsTrigger
                key={status}
                value={status}
                className="relative flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3 text-xs sm:text-sm"
              >
                <config.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{config.label}</span>
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 sm:relative sm:top-0 sm:right-0 sm:ml-1 h-4 w-4 flex items-center justify-center text-[10px] sm:text-xs"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.keys(statusConfig).map((status) => (
          <TabsContent key={status} value={status} className="mt-6">
            {filteredPedidos.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">
                    Nenhum pedido {statusConfig[status as PedidoStatus].label.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPedidos.map((pedido) => {
                  const StatusIcon = statusConfig[pedido.status_cozinha as PedidoStatus].icon;
                  const nextStatus = getNextStatus(pedido.status_cozinha as PedidoStatus);

                  return (
                    <Card key={pedido.id} className="relative overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 right-0 h-1 ${statusConfig[pedido.status_cozinha as PedidoStatus].color}`}
                      />
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Mesa {pedido.comanda?.mesa?.numero_mesa || "-"}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig[pedido.status_cozinha as PedidoStatus].label}
                          </Badge>
                        </div>
                        {pedido.comanda?.nome_cliente && (
                          <p className="text-sm text-muted-foreground">{pedido.comanda.nome_cliente}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(pedido.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{pedido.produto?.nome || "Produto não encontrado"}</span>
                            <Badge variant="secondary">x{pedido.quantidade}</Badge>
                          </div>
                          {pedido.notas_cliente && (
                            <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                              📝 {pedido.notas_cliente}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {nextStatus && (
                            <Button
                              className="flex-1"
                              onClick={() => updateStatusMutation.mutate({ id: pedido.id, status: nextStatus })}
                              disabled={updateStatusMutation.isPending}
                            >
                              {updateStatusMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : null}
                              {statusConfig[nextStatus].label}
                            </Button>
                          )}
                          {pedido.status_cozinha !== "cancelado" && pedido.status_cozinha !== "entregue" && (
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => updateStatusMutation.mutate({ id: pedido.id, status: "cancelado" })}
                              disabled={updateStatusMutation.isPending}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
