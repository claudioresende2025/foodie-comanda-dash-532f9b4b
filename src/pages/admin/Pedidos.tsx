import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Clock, ChefHat, CheckCircle, Truck, XCircle, Loader2, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

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

// Som de notificação
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log("Audio not supported");
  }
};

export default function Pedidos() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PedidoStatus>("pendente");

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
          produto:produtos(nome, preco),
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

  // ===============================
  // REALTIME
  // ===============================
  useEffect(() => {
    if (!profile?.empresa_id) return;

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.empresa_id, queryClient]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">KDS - Cozinha</h1>
          <p className="text-muted-foreground">Gerencie os pedidos da cozinha</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

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
