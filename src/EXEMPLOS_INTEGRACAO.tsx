// EXEMPLO: Como integrar o sistema de Fidelidade no Checkout
// Este arquivo mostra como integrar os componentes nos próximos passos

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ==============================================================
// EXEMPLO 1: Integrar CupomValidator no DeliveryRestaurant
// ==============================================================

// import { CupomValidator } from '@/components/delivery/CupomValidator';
// import { useFidelidadeStatus, adicionarPontosFidelidade } from '@/hooks/useFidelidade';

export function DeliveryRestaurantComFidelidade() {
  // Exemplo: variáveis que viriam de props ou contexto
  const empresaId = 'example-empresa-id';
  const cartSubtotal = 50.00;
  const taxaEntrega = 5.00;
  const setCartTotal = (value: number) => console.log('Total:', value);
  const fidelidadeData = { pontos_atuais: 80, pontos_necessarios: 100, percentual_conclusao: 80 };
  
  const [cupomAplicado, setCupomAplicado] = useState<{
    id: string;
    codigo: string;
    desconto: number;
  } | null>(null);
  
  const [descontoTotal, setDescontoTotal] = useState(0);

  const handleCupomAplicado = (cupomId: string, desconto: number) => {
    // Atualizar estado
    const cupom = { id: cupomId, codigo: 'PROMO2024', desconto };
    setCupomAplicado(cupom);
    setDescontoTotal(desconto);
    
    // Atualizar total do pedido
    const novoTotal = (cartSubtotal - desconto) + taxaEntrega;
    setCartTotal(novoTotal);
  };

  const handleCupomRemovido = () => {
    setCupomAplicado(null);
    setDescontoTotal(0);
    setCartTotal(cartSubtotal + taxaEntrega);
  };

  return (
    <div>
      {/* Seção de Fidelidade do Cliente */}
      {fidelidadeData && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-purple-900 mb-2">Seu Programa de Fidelidade</h4>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-purple-800">
                  {fidelidadeData.pontos_atuais} / {fidelidadeData.pontos_necessarios} pontos
                </span>
                <span className="text-purple-600 font-semibold">
                  {fidelidadeData.percentual_conclusao.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${fidelidadeData.percentual_conclusao}%` }}
                />
              </div>
            </div>
            {fidelidadeData.pontos_atuais >= fidelidadeData.pontos_necessarios && (
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                Resgatar! 🎁
              </button>
            )}
          </div>
        </div>
      )}

      {/* Validador de Cupom */}
      {/* <CupomValidator
        empresaId={empresaId}
        subtotal={cartSubtotal}
        onCupomAplicado={handleCupomAplicado}
        onCupomRemovido={handleCupomRemovido}
        cupomAplicado={cupomAplicado}
      /> */}
    </div>
  );
}

// ==============================================================
// EXEMPLO 2: Adicionar Pontos após Pedido Confirmado
// ==============================================================

async function finalizarPedidoComFidelidade(
  empresaId: string,
  userId: string,
  pedidoData: {
    endereco_id: string;
    cupom_id?: string;
    subtotal: number;
    taxa_entrega: number;
    total: number;
    forma_pagamento: string;
  }
) {
  try {
    // 1. Criar pedido normalmente
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos_delivery')
      .insert({
        empresa_id: empresaId,
        user_id: userId,
        endereco_id: pedidoData.endereco_id,
        status: 'pendente' as const,
        cupom_id: pedidoData.cupom_id || null,
        subtotal: pedidoData.subtotal,
        taxa_entrega: pedidoData.taxa_entrega,
        total: pedidoData.total,
        forma_pagamento: pedidoData.forma_pagamento as any,
      })
      .select()
      .single();

    if (pedidoError) throw pedidoError;

    // 2. Adicionar pontos de fidelidade
    // import { adicionarPontosFidelidade } from '@/hooks/useFidelidade';
    const adicionarPontosFidelidade = async (empresaId: string, userId: string, pedidoId: string, valor: number) => {
      return [{ pontos_adicionados: Math.floor(valor / 10) }];
    };
    const pontos = await adicionarPontosFidelidade(
      empresaId,
      userId,
      pedido.id,
      pedidoData.subtotal // Usa valor do pedido, não o total com desconto
    );

    // 3. Log de evento de analytics (função RPC não implementada ainda)
    // await supabase.rpc('log_analytics_event', {
    //   _empresa_id: empresaId,
    //   _tipo_evento: 'pedido_criado',
    //   _user_id: userId,
    //   _pedido_delivery_id: pedido.id,
    //   _dados_adicionais: {
    //     valor: pedidoData.total,
    //     forma_pagamento: pedidoData.forma_pagamento,
    //     pontos_ganhos: pontos?.[0]?.pontos_adicionados,
    //   },
    // });

    toast.success(
      `Pedido criado! 🎉 Você ganhou ${pontos?.[0]?.pontos_adicionados || 0} pontos de fidelidade`
    );
    return pedido;
  } catch (err: any) {
    toast.error(err.message);
    throw err;
  }
}

// ==============================================================
// EXEMPLO 3: Dashboard com Métricas de Fidelidade
// ==============================================================

export function DashboardComFidelidade() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;

  // Buscar clientes inativos (função RPC não implementada ainda)
  const { data: clientesInativos } = useQuery({
    queryKey: ['clientes_inativos', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      // const { data, error } = await supabase.rpc(
      //   'identificar_clientes_inativos',
      //   {
      //     _empresa_id: empresaId,
      //     _dias_inatividade: 15,
      //   }
      // );
      // if (error) throw error;
      // return data?.[0];
      return { total_clientes: 0, proximos_a_resgatar_fidelidade: 0 };
    },
    enabled: !!empresaId,
  });

  // Buscar top produtos (função RPC não implementada ainda)
  const { data: topProdutos } = useQuery({
    queryKey: ['top_produtos', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      // const { data, error } = await supabase.rpc('top_produtos_vendidos', {
      //   _empresa_id: empresaId,
      //   _dias_atras: 30,
      //   _limite: 5,
      // });
      // if (error) throw error;
      // return data || [];
      return [];
    },
    enabled: !!empresaId,
  });

  return (
    <div className="space-y-6">
      {/* Card: Clientes Inativos para Reengajamento */}
      <Card>
        <CardHeader>
          <CardTitle>Oportunidades de Reengajamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Clientes Inativos (15+ dias)</p>
              <p className="text-3xl font-bold text-orange-600">
                {clientesInativos?.total_clientes || 0}
              </p>
              <p className="text-xs text-orange-700 mt-2">👉 Enviar cupom relâmpago</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Próximos a Resgatar</p>
              <p className="text-3xl font-bold text-green-600">
                {clientesInativos?.proximos_a_resgatar_fidelidade || 0}
              </p>
              <p className="text-xs text-green-700 mt-2">🎁 Aumentar capacidade de estoque</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card: Top Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos Mais Vendidos (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(Array.isArray(topProdutos) ? topProdutos : []).map((produto: any, index: number) => (
              <div key={produto.produto_id} className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{produto.nome_produto}</p>
                  <p className="text-sm text-muted-foreground">
                    {produto.quantidade_vendida} vendidos • R$ {produto.valor_total.toFixed(2)} ({produto.percentual_vendas}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==============================================================
// EXEMPLO 4: Notificar Cliente quando Cupom Relâmpago é Criado
// ==============================================================

async function criarCupomENotificar(cupomData: {
  empresa_id: string;
  codigo: string;
  tipo: 'percentual' | 'valor_fixo';
  valor: number;
}) {
  try {
    // 1. Criar cupom
    const { data: cupom, error: cupomError } = await supabase
      .from('cupons')
      .insert(cupomData)
      .select()
      .single();

    if (cupomError) throw cupomError;

    // 2. Buscar todos os users que fizeram pedidos na empresa
    const { data: usuarios } = await supabase
      .from('pedidos_delivery')
      .select('user_id')
      .eq('empresa_id', cupomData.empresa_id)
      .neq('user_id', null)
      .limit(100);

    // 3. Enviar notificação para cada usuário
    let uniqueUserIds: string[] = [];
    if (usuarios) {
      uniqueUserIds = Array.from(new Set(usuarios.map((u: { user_id: string }) => u.user_id)));
      
      // Enviar notificações (função RPC não implementada ainda)
      // for (const userId of uniqueUserIds) {
      //   await supabase.rpc('send_notification', {
      //     _user_id: userId,
      //     _empresa_id: cupomData.empresa_id,
      //     _titulo: '🎉 Cupom Relâmpago!',
      //     _mensagem: `Use o código ${cupom.codigo} para ${
      //       cupom.tipo === 'percentual' 
      //         ? `${cupom.valor}% de desconto`
      //         : `R$ ${cupom.valor.toFixed(2)} de desconto`
      //     }`,
      //     _tipo: 'promo_relampago',
      //     _acao_url: `/delivery/${cupomData.empresa_id}`,
      //   });
      // }
    }

    toast.success(`Cupom criado e ${uniqueUserIds.length} clientes notificados!`);
    return cupom;
  } catch (err: any) {
    toast.error(err.message);
    throw err;
  }
}

// ==============================================================
// EXEMPLO 5: Integrar com PWA Update Detection
// ==============================================================

export function UseVersionDetector() {
  useEffect(() => {
    // Detectar nova versão a cada 30 segundos
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/manifest.json');
        const manifest = await response.json();
        
        const currentVersion = localStorage.getItem('app_version');
        if (currentVersion && currentVersion !== manifest.version) {
          // Mostrar banner de atualização
          const banner = document.createElement('div');
          banner.className = 'fixed bottom-4 right-4 bg-primary text-white p-4 rounded-lg shadow-lg z-50';
          banner.innerHTML = `
            <p className="font-semibold mb-2">Nova versão disponível!</p>
            <button onclick="window.location.reload()" className="bg-white text-primary px-4 py-2 rounded font-semibold">
              Atualizar Agora
            </button>
          `;
          document.body.appendChild(banner);
        }
        localStorage.setItem('app_version', manifest.version);
      } catch (err) {
        console.error('Erro ao verificar atualização:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);
}

// ==============================================================
// EXEMPLO 6: Chat Simples Cliente-Estabelecimento
// ==============================================================

export function ChatDelivery({ pedidoId, empresaId }: { pedidoId: string; empresaId: string }) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<Array<{ id: string; usuario_id: string; mensagem: string }>>([]);
  const [novaMsg, setNovaMsg] = useState('');

  // Realtime subscription (tabela chat_mensagens não implementada ainda)
  useEffect(() => {
    // const subscription = supabase
    //   .channel(`chat_${pedidoId}`)
    //   .on('postgres_changes', {
    //     event: '*',
    //     schema: 'public',
    //     table: 'chat_mensagens',
    //     filter: `conversa_id=eq.${pedidoId}`
    //   }, (payload: any) => {
    //     setMensagens((prev: any[]) => [...prev, payload.new]);
    //   })
    //   .subscribe();
    //
    // return () => { subscription.unsubscribe(); };
  }, [pedidoId]);

  const enviarMensagem = async () => {
    if (!novaMsg.trim() || !user) return;

    // Tabela chat_mensagens não implementada ainda
    // const { error } = await supabase
    //   .from('chat_mensagens')
    //   .insert({
    //     conversa_id: pedidoId,
    //     usuario_id: user.id,
    //     mensagem: novaMsg,
    //   });
    //
    // if (!error) setNovaMsg('');
    
    // Simulação
    setNovaMsg('');
    toast.success('Funcionalidade de chat não implementada');
  };

  return (
    <div className="flex flex-col h-96 border rounded-lg">
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {mensagens.map((msg: { id: string; usuario_id: string; mensagem: string }) => (
          <div key={msg.id} className={`flex ${msg.usuario_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-2 rounded-lg ${
              msg.usuario_id === user?.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              {msg.mensagem}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-4 border-t">
        <input
          value={novaMsg}
          onChange={(e) => setNovaMsg(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && enviarMensagem()}
          placeholder="Enviar mensagem..."
          className="flex-1 px-3 py-2 border rounded-lg"
        />
        <button onClick={enviarMensagem} className="bg-primary text-white px-4 py-2 rounded-lg">
          Enviar
        </button>
      </div>
    </div>
  );
}

export default {
  DeliveryRestaurantComFidelidade,
  finalizarPedidoComFidelidade,
  DashboardComFidelidade,
  criarCupomENotificar,
  UseVersionDetector,
  ChatDelivery,
};
