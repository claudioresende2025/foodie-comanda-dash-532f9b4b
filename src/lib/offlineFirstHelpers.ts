/**
 * Offline-First Helpers
 * 
 * Funções auxiliares para operações que devem funcionar offline.
 * Todas seguem o padrão: Dexie → Supabase → Update Local
 */

import { syncService } from './syncService';
import { supabase } from '@/integrations/supabase/client';

// ==================== TIPOS ====================

interface FecharComandaParams {
  comandaId: string;
  mesaId?: string;
  formaPagamento: string;
  formasPagamento?: { metodo: string; valor: number }[];
  total: number;
  trocoPara?: number;
}

interface CancelarComandaParams {
  comandaId: string;
  mesaId?: string;
}

interface AtenderChamadaParams {
  chamadaId: string;
}

interface CriarPedidoParams {
  comandaId: string;
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  notas?: string;
  empresaId: string;
}

interface AtualizarStatusMesaParams {
  mesaId: string;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'solicitou_fechamento';
}

interface AtualizarStatusPedidoParams {
  pedidoId: string;
  status: 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';
}

// ==================== COMANDA ====================

/**
 * Fecha uma comanda - Offline-First
 */
export async function fecharComandaOffline(params: FecharComandaParams): Promise<{ success: boolean; error?: string }> {
  const { comandaId, mesaId, formaPagamento, formasPagamento, total, trocoPara } = params;
  
  try {
    const { db } = await import('./db');
    const agora = new Date().toISOString();

    // 1. DEXIE PRIMEIRO - Atualizar comanda localmente
    const comandaUpdate = {
      id: comandaId,
      status: 'fechada',
      forma_pagamento: formaPagamento === 'multiplo' ? 'dinheiro' : formaPagamento,
      formas_pagamento: formasPagamento ? JSON.stringify(formasPagamento) : null,
      troco_para: trocoPara || null,
      total,
      data_fechamento: agora,
      sincronizado: 0,
      _operation: 'UPDATE',
    };
    
    await db.comandas.update(comandaId, comandaUpdate);
    console.log('[OfflineFirst] Comanda fechada localmente:', comandaId);

    // 2. DEXIE - Liberar mesa localmente
    if (mesaId) {
      await db.mesas.update(mesaId, { 
        status: 'disponivel', 
        mesa_juncao_id: null,
        sincronizado: 0,
        _operation: 'UPDATE',
      });
      console.log('[OfflineFirst] Mesa liberada localmente:', mesaId);

      // 3. DEXIE - Atender chamadas pendentes desta mesa
      const chamadasPendentes = await db.chamadas_garcom
        .where('mesa_id').equals(mesaId)
        .filter(c => c.status === 'pendente')
        .toArray();
      
      for (const chamada of chamadasPendentes) {
        await db.chamadas_garcom.update(chamada.id, {
          status: 'atendida',
          atendida_at: agora,
          sincronizado: 0,
          _operation: 'UPDATE',
        });
      }
    }

    // 4. SUPABASE - Sincronizar se online
    if (navigator.onLine) {
      try {
        // Fechar comanda no Supabase
        const { error: comandaError } = await supabase
          .from('comandas')
          .update({
            status: 'fechada',
            forma_pagamento: formaPagamento === 'multiplo' ? 'dinheiro' : formaPagamento,
            troco_para: trocoPara || null,
            total,
            data_fechamento: agora,
          })
          .eq('id', comandaId);

        if (comandaError) {
          console.warn('[OfflineFirst] Erro ao sincronizar comanda:', comandaError.message);
        } else {
          await db.comandas.update(comandaId, { sincronizado: 1 });
        }

        // Liberar mesa via RPC
        if (mesaId) {
          const { error: mesaError } = await supabase.rpc('liberar_mesa', { p_mesa_id: mesaId });
          if (mesaError) {
            console.warn('[OfflineFirst] Erro ao liberar mesa via RPC:', mesaError.message);
            // Fallback: update direto
            await supabase.from('mesas').update({ status: 'disponivel', mesa_juncao_id: null }).eq('id', mesaId);
          } else {
            await db.mesas.update(mesaId, { sincronizado: 1 });
          }

          // Atender chamadas
          await supabase
            .from('chamadas_garcom')
            .update({ status: 'atendida', atendida_at: agora })
            .eq('mesa_id', mesaId)
            .eq('status', 'pendente');
        }
      } catch (syncError: any) {
        console.warn('[OfflineFirst] Falha na sincronização, dados salvos localmente:', syncError.message);
        // Agenda retry
        syncService.scheduleRetry();
      }
    } else {
      console.log('[OfflineFirst] Offline - comanda fechada apenas localmente');
      syncService.scheduleRetry();
    }

    // 5. Notificar servidor local do caixa
    try {
      await fetch('http://192.168.2.111:3000/api/local/comanda/fechar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: comandaId, total, mesa_id: mesaId }),
      });
    } catch (e) {
      console.warn('[OfflineFirst] Servidor local inacessível');
    }

    return { success: true };

  } catch (error: any) {
    console.error('[OfflineFirst] Erro ao fechar comanda:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancela uma comanda - Offline-First
 */
export async function cancelarComandaOffline(params: CancelarComandaParams): Promise<{ success: boolean; error?: string }> {
  const { comandaId, mesaId } = params;
  
  try {
    const { db } = await import('./db');
    const agora = new Date().toISOString();

    // 1. DEXIE - Cancelar comanda localmente
    await db.comandas.update(comandaId, {
      status: 'cancelada',
      data_fechamento: agora,
      sincronizado: 0,
      _operation: 'UPDATE',
    });
    console.log('[OfflineFirst] Comanda cancelada localmente:', comandaId);

    // 2. DEXIE - Liberar mesa
    if (mesaId) {
      await db.mesas.update(mesaId, {
        status: 'disponivel',
        mesa_juncao_id: null,
        sincronizado: 0,
        _operation: 'UPDATE',
      });
      console.log('[OfflineFirst] Mesa liberada localmente:', mesaId);
    }

    // 3. SUPABASE - Sincronizar se online
    if (navigator.onLine) {
      try {
        const { error: comandaError } = await supabase
          .from('comandas')
          .update({ status: 'cancelada', data_fechamento: agora })
          .eq('id', comandaId);

        if (!comandaError) {
          await db.comandas.update(comandaId, { sincronizado: 1 });
        }

        if (mesaId) {
          const { error: mesaError } = await supabase.rpc('liberar_mesa', { p_mesa_id: mesaId });
          if (!mesaError) {
            await db.mesas.update(mesaId, { sincronizado: 1 });
          }
        }
      } catch (syncError: any) {
        console.warn('[OfflineFirst] Falha na sincronização:', syncError.message);
        syncService.scheduleRetry();
      }
    } else {
      syncService.scheduleRetry();
    }

    return { success: true };

  } catch (error: any) {
    console.error('[OfflineFirst] Erro ao cancelar comanda:', error);
    return { success: false, error: error.message };
  }
}

// ==================== CHAMADAS GARÇOM ====================

/**
 * Atende uma chamada de garçom - Offline-First
 */
export async function atenderChamadaOffline(params: AtenderChamadaParams): Promise<{ success: boolean; error?: string }> {
  const { chamadaId } = params;
  
  try {
    const { db } = await import('./db');
    const agora = new Date().toISOString();

    // 1. DEXIE PRIMEIRO
    await db.chamadas_garcom.update(chamadaId, {
      status: 'atendida',
      atendida_at: agora,
      sincronizado: 0,
      _operation: 'UPDATE',
    });
    console.log('[OfflineFirst] Chamada atendida localmente:', chamadaId);

    // 2. SUPABASE se online
    if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('chamadas_garcom')
          .update({ status: 'atendida', atendida_at: agora })
          .eq('id', chamadaId);

        if (!error) {
          await db.chamadas_garcom.update(chamadaId, { sincronizado: 1 });
        }
      } catch (syncError: any) {
        console.warn('[OfflineFirst] Falha na sincronização:', syncError.message);
        syncService.scheduleRetry();
      }
    } else {
      syncService.scheduleRetry();
    }

    return { success: true };

  } catch (error: any) {
    console.error('[OfflineFirst] Erro ao atender chamada:', error);
    return { success: false, error: error.message };
  }
}

// ==================== PEDIDOS ====================

/**
 * Cria um pedido - Offline-First
 */
export async function criarPedidoOffline(params: CriarPedidoParams): Promise<{ success: boolean; pedidoId?: string; error?: string }> {
  const { comandaId, produtoId, quantidade, precoUnitario, notas, empresaId } = params;
  
  try {
    const { db } = await import('./db');
    const pedidoId = crypto.randomUUID();
    const agora = new Date().toISOString();

    // 1. DEXIE PRIMEIRO
    const pedido = {
      id: pedidoId,
      comanda_id: comandaId,
      produto_id: produtoId,
      quantidade,
      preco_unitario: precoUnitario,
      subtotal: precoUnitario * quantidade,
      notas_cliente: notas || null,
      status_cozinha: 'pendente',
      criado_em: agora,
      sincronizado: 0,
      _operation: 'INSERT',
    };

    await db.pedidos.put(pedido);
    console.log('[OfflineFirst] Pedido criado localmente:', pedidoId);

    // 2. SUPABASE se online
    if (navigator.onLine) {
      try {
        const { sincronizado, _operation, ...dataToSync } = pedido;
        const { error } = await supabase.from('pedidos').insert([dataToSync]);

        if (!error) {
          await db.pedidos.update(pedidoId, { sincronizado: 1 });
        }
      } catch (syncError: any) {
        console.warn('[OfflineFirst] Falha na sincronização:', syncError.message);
        syncService.scheduleRetry();
      }
    } else {
      syncService.scheduleRetry();
    }

    // 3. Notificar servidor local
    try {
      await fetch('http://192.168.2.111:3000/api/local/realizar-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([pedido]),
      });
    } catch (e) {
      console.warn('[OfflineFirst] Servidor local inacessível');
    }

    return { success: true, pedidoId };

  } catch (error: any) {
    console.error('[OfflineFirst] Erro ao criar pedido:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza status de um pedido - Offline-First
 */
export async function atualizarStatusPedidoOffline(params: AtualizarStatusPedidoParams): Promise<{ success: boolean; error?: string }> {
  const { pedidoId, status } = params;
  
  try {
    const { db } = await import('./db');
    const agora = new Date().toISOString();

    // Campos adicionais baseados no status
    const updates: Record<string, any> = {
      status_cozinha: status,
      sincronizado: 0,
      _operation: 'UPDATE',
    };

    if (status === 'preparando') {
      updates.iniciado_em = agora;
    } else if (status === 'pronto') {
      updates.finalizado_em = agora;
    } else if (status === 'entregue') {
      updates.entregue_em = agora;
    }

    // 1. DEXIE PRIMEIRO
    await db.pedidos.update(pedidoId, updates);
    console.log('[OfflineFirst] Status do pedido atualizado localmente:', pedidoId, status);

    // 2. SUPABASE se online
    if (navigator.onLine) {
      try {
        const { sincronizado, _operation, ...dataToSync } = updates;
        const { error } = await supabase
          .from('pedidos')
          .update(dataToSync)
          .eq('id', pedidoId);

        if (!error) {
          await db.pedidos.update(pedidoId, { sincronizado: 1 });
        }
      } catch (syncError: any) {
        console.warn('[OfflineFirst] Falha na sincronização:', syncError.message);
        syncService.scheduleRetry();
      }
    } else {
      syncService.scheduleRetry();
    }

    return { success: true };

  } catch (error: any) {
    console.error('[OfflineFirst] Erro ao atualizar status do pedido:', error);
    return { success: false, error: error.message };
  }
}

// ==================== MESAS ====================

/**
 * Atualiza status de uma mesa - Offline-First
 */
export async function atualizarStatusMesaOffline(params: AtualizarStatusMesaParams): Promise<{ success: boolean; error?: string }> {
  const { mesaId, status } = params;
  
  try {
    const { db } = await import('./db');

    // 1. DEXIE PRIMEIRO
    await db.mesas.update(mesaId, {
      status,
      sincronizado: 0,
      _operation: 'UPDATE',
    });
    console.log('[OfflineFirst] Status da mesa atualizado localmente:', mesaId, status);

    // 2. SUPABASE se online
    if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('mesas')
          .update({ status })
          .eq('id', mesaId);

        if (!error) {
          await db.mesas.update(mesaId, { sincronizado: 1 });
        }
      } catch (syncError: any) {
        console.warn('[OfflineFirst] Falha na sincronização:', syncError.message);
        syncService.scheduleRetry();
      }
    } else {
      syncService.scheduleRetry();
    }

    return { success: true };

  } catch (error: any) {
    console.error('[OfflineFirst] Erro ao atualizar status da mesa:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cria uma nova mesa - Offline-First
 */
export async function criarMesaOffline(params: { empresaId: string; numeroMesa: number; capacidade?: number }): Promise<{ success: boolean; mesaId?: string; error?: string }> {
  const { empresaId, numeroMesa, capacidade = 4 } = params;
  
  try {
    const { db } = await import('./db');
    const mesaId = crypto.randomUUID();

    // 1. DEXIE PRIMEIRO
    const mesa = {
      id: mesaId,
      empresa_id: empresaId,
      numero_mesa: numeroMesa,
      numero: numeroMesa, // Compatibilidade
      capacidade,
      status: 'disponivel',
      ativo: true,
      sincronizado: 0,
      _operation: 'INSERT',
    };

    await db.mesas.put(mesa);
    console.log('[OfflineFirst] Mesa criada localmente:', mesaId);

    // 2. SUPABASE se online
    if (navigator.onLine) {
      try {
        const { sincronizado, _operation, numero, ...dataToSync } = mesa;
        const { error } = await supabase.from('mesas').insert([dataToSync]);

        if (!error) {
          await db.mesas.update(mesaId, { sincronizado: 1 });
        }
      } catch (syncError: any) {
        console.warn('[OfflineFirst] Falha na sincronização:', syncError.message);
        syncService.scheduleRetry();
      }
    } else {
      syncService.scheduleRetry();
    }

    return { success: true, mesaId };

  } catch (error: any) {
    console.error('[OfflineFirst] Erro ao criar mesa:', error);
    return { success: false, error: error.message };
  }
}

// ==================== VENDA AVULSA ====================

/**
 * Registra uma venda avulsa - Offline-First
 */
export async function registrarVendaAvulsaOffline(params: {
  empresaId: string;
  caixaId: string;
  itens: { produtoId: string; nome: string; quantidade: number; precoUnitario: number }[];
  total: number;
  formaPagamento: string;
  desconto?: number;
}): Promise<{ success: boolean; vendaId?: string; error?: string }> {
  const { empresaId, caixaId, itens, total, formaPagamento, desconto = 0 } = params;
  
  try {
    const { db } = await import('./db');
    const vendaId = crypto.randomUUID();
    const agora = new Date().toISOString();

    // 1. DEXIE PRIMEIRO - Registrar venda
    const venda = {
      id: vendaId,
      empresa_id: empresaId,
      caixa_id: caixaId,
      tipo: 'venda_avulsa',
      itens: JSON.stringify(itens),
      valor_total: total,
      desconto,
      forma_pagamento: formaPagamento,
      criado_em: agora,
      sincronizado: 0,
      _operation: 'INSERT',
    };

    await db.vendas_concluidas.put(venda);
    console.log('[OfflineFirst] Venda avulsa registrada localmente:', vendaId);

    // 2. DEXIE - Movimentação de caixa
    const movimentacao = {
      id: crypto.randomUUID(),
      caixa_id: caixaId,
      tipo: 'entrada',
      valor: total,
      descricao: `Venda avulsa - ${itens.map(i => i.nome).join(', ')}`,
      forma_pagamento: formaPagamento,
      criado_em: agora,
      sincronizado: 0,
      _operation: 'INSERT',
    };

    await db.movimentacoes_caixa.put(movimentacao);

    // 3. SUPABASE se online
    if (navigator.onLine) {
      try {
        // Sincronizar venda
        const { sincronizado, _operation, ...vendaToSync } = venda;
        const { error: vendaError } = await supabase.from('vendas_concluidas').insert([vendaToSync]);
        if (!vendaError) {
          await db.vendas_concluidas.update(vendaId, { sincronizado: 1 });
        }

        // Sincronizar movimentação
        const { sincronizado: s, _operation: o, ...movToSync } = movimentacao;
        const { error: movError } = await supabase.from('movimentacoes_caixa').insert([movToSync]);
        if (!movError) {
          await db.movimentacoes_caixa.update(movimentacao.id, { sincronizado: 1 });
        }
      } catch (syncError: any) {
        console.warn('[OfflineFirst] Falha na sincronização:', syncError.message);
        syncService.scheduleRetry();
      }
    } else {
      syncService.scheduleRetry();
    }

    return { success: true, vendaId };

  } catch (error: any) {
    console.error('[OfflineFirst] Erro ao registrar venda avulsa:', error);
    return { success: false, error: error.message };
  }
}
