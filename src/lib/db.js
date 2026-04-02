import Dexie from 'dexie';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// CONFIGURAÇÃO DO BANCO LOCAL (INDEXEDDB)
// ============================================
export const db = new Dexie('FoodComandaPro_DB');

// ============================================
// TRATADORES DE ERROS E ESTABILIZAÇÃO ROBUSTA
// ============================================

// Flag para evitar múltiplas tentativas de reopen simultâneas
let isReopening = false;
let reopenPromise = null;
let reopenAttempts = 0;
const MAX_REOPEN_ATTEMPTS = 2;

/**
 * GARANTE que o banco está aberto ANTES de qualquer operação
 * Se fechado, reabre automaticamente com retry
 * Agora usa initializeDb() para tratar VersionError
 */
export async function ensureDbOpen() {
  // Se já está aberto, retorna imediatamente
  if (db.isOpen()) {
    reopenAttempts = 0; // Reset contador em sucesso
    return true;
  }
  
  // Se outra tentativa de reopen está em andamento, aguarda
  if (isReopening && reopenPromise) {
    try {
      await reopenPromise;
      return db.isOpen();
    } catch {
      return false;
    }
  }
  
  // Verificar limite de tentativas
  if (reopenAttempts >= MAX_REOPEN_ATTEMPTS) {
    console.error('[Dexie] ❌ Máximo de tentativas de reopen atingido');
    // Reset após 5s para permitir nova tentativa
    setTimeout(() => { reopenAttempts = 0; }, 5000);
    return false;
  }
  
  isReopening = true;
  reopenAttempts++;
  console.log(`[Dexie] 🔄 Reabrindo banco de dados (tentativa ${reopenAttempts}/${MAX_REOPEN_ATTEMPTS})...`);
  
  try {
    // Usar initializeDb() para ter tratamento de VersionError
    reopenPromise = initializeDb();
    const result = await reopenPromise;
    
    if (result) {
      console.log('[Dexie] ✅ Banco reaberto com sucesso');
      reopenAttempts = 0; // Reset em sucesso
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('[Dexie] ❌ Erro ao reabrir banco:', err);
    
    // VersionError já é tratado em initializeDb()
    // Outros erros: tentar recuperação forçada
    const errMsg = (err?.message || '').toLowerCase();
    const errName = err?.name || '';
    
    // Não tentar recovery se for VersionError (já tratado)
    if (errName === 'VersionError') {
      return false;
    }
    
    if (errMsg.includes('invalidstateerror') || errMsg.includes('closed')) {
      console.log('[Dexie] 🔧 Tentando recuperação forçada...');
      try {
        // Fechar conexão atual se existir
        if (db.isOpen()) {
          db.close();
        }
        // Aguardar um tick e reabrir via initializeDb
        await new Promise(r => setTimeout(r, 100));
        const recovered = await initializeDb();
        if (recovered) {
          console.log('[Dexie] ✅ Recuperação forçada bem-sucedida');
          reopenAttempts = 0;
          return true;
        }
        return false;
      } catch (retryErr) {
        console.error('[Dexie] ❌ Recuperação forçada falhou:', retryErr);
        return false;
      }
    }
    
    return false;
  } finally {
    isReopening = false;
    reopenPromise = null;
  }
}

/**
 * Wrapper OBRIGATÓRIO para operações Dexie
 * Garante banco aberto + auto-retry em falha
 */
export async function safeDbOperation(operation) {
  // PASSO 1: Garantir banco aberto ANTES da operação
  const isOpen = await ensureDbOpen();
  if (!isOpen) {
    console.warn('[Dexie] Banco não disponível, operação ignorada');
    return null;
  }
  
  try {
    return await operation();
  } catch (err) {
    const errMsg = (err?.message || '').toLowerCase();
    const errName = err?.name || '';
    
    // VersionError: Apenas logar, não tentar reload
    if (errName === 'VersionError' || errMsg.includes('version')) {
      console.warn('[Dexie] ⚠️ VersionError durante operação');
      return null;
    }
    
    // InvalidStateError ou Database Closed → única tentativa de retry
    if (errMsg.includes('invalidstateerror') || 
        errMsg.includes('database') && errMsg.includes('closed') ||
        errMsg.includes('database is closing')) {
      console.warn('[Dexie] ⚠️ Banco fechou durante operação, tentando reabrir...');
      
      const reopened = await ensureDbOpen();
      if (reopened) {
        console.log('[Dexie] 🔄 Repetindo operação após reopen...');
        return await operation();
      }
      
      throw new Error('Banco de dados fechou inesperadamente. Reinicie o aplicativo.');
    }
    
    throw err;
  }
}

// ============================================
// HANDLER DE VERSIONCHANGE (SEM RELOAD AUTOMÁTICO)
// ============================================
db.on('versionchange', (event) => {
  console.warn('[Dexie] ⚡ VERSIONCHANGE DETECTADO');
  console.warn('[Dexie] oldVersion:', event.oldVersion, 'newVersion:', event.newVersion);
  
  // Notificar componentes React
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('dexie-versionchange', { detail: event }));
  }
  
  // Fechar o banco para liberar lock
  db.close();
  
  // NÃO fazer reload automático - deixar o usuário decidir
  console.log('[Dexie] Banco fechado. Próxima operação vai reabrir.');
});

// Handler para blocked - banco está bloqueado por outra aba
db.on('blocked', () => {
  console.warn('[Dexie] ⏳ Banco bloqueado por outra aba - Aguardando...');
});

// Handler para ready - banco pronto
db.on('ready', () => {
  console.log('[Dexie] ✅ Banco de dados pronto (versão 16)');
});

// ============================================
// INICIALIZAÇÃO SEGURA COM TRATAMENTO DE VERSIONERROR
// ============================================
let dbInitialized = false;
let dbInitPromise = null;

/**
 * Inicializa o banco de dados com tratamento de VersionError
 * Se VersionError ocorrer, DELETA o banco e RECARREGA a página
 * @returns {Promise<boolean>} true se inicializado com sucesso
 */
export async function initializeDb() {
  // Se já inicializado, retornar
  if (dbInitialized && db.isOpen()) {
    return true;
  }
  
  // Se já tem uma promise de init em andamento, aguardar
  if (dbInitPromise) {
    return dbInitPromise;
  }
  
  dbInitPromise = (async () => {
    try {
      console.log('[Dexie] 🔄 Inicializando banco de dados (versão 16)...');
      
      if (!db.isOpen()) {
        await db.open();
      }
      
      dbInitialized = true;
      console.log('[Dexie] ✅ Banco inicializado com sucesso');
      return true;
      
    } catch (err) {
      const errName = err?.name || '';
      const errMsg = (err?.message || '').toLowerCase();
      
      console.error('[Dexie] ❌ Erro ao abrir banco:', err);
      
      // VERSIONERROR: Versão do código diferente da versão no navegador
      // Apenas logar - NÃO deletar automaticamente para evitar loop
      if (errName === 'VersionError' || errMsg.includes('version')) {
        console.warn('[Dexie] 🔧 VersionError detectado - Banco precisa ser recriado');
        console.warn('[Dexie] Para resolver: limpe os dados do site no navegador ou use Ctrl+Shift+Delete');
        
        // Marcar flag para UI mostrar mensagem
        if (typeof window !== 'undefined') {
          window.__DEXIE_VERSION_ERROR__ = true;
        }
        
        // NÃO fazer reload automático - causa loop infinito
        return false;
      }
      
      // Outros erros: apenas logar
      console.error('[Dexie] Erro não tratado:', err);
      return false;
    } finally {
      dbInitPromise = null;
    }
  })();
  
  return dbInitPromise;
}

// ============================================
// NÃO AUTO-INICIALIZAR NA IMPORTAÇÃO
// ============================================
// A inicialização será feita sob demanda quando necessário
// Isso evita loops de reload e tela branca

// ============================================
// VERSÃO 16: CORREÇÃO DE VERSIONERROR
// ============================================
// Histórico:
// - v12: Adicionada logs_sincronizacao
// - v13-15: Atualizações incrementais (browser cache)
// - v16: Consolidação de esquema + tratamento de VersionError
//
// sync_status: 'pending' | 'synced' | 'error' - Estado da sincronização
// sync_error: string | null - Mensagem de erro se houver falha
// sync_error_code: string | null - Código do erro (ex: 23503 para FK violation)
// sync_error_at: string | null - Timestamp do erro
// atualizado_em: string - Timestamp para Last Write Wins
// logs_sincronizacao: Últimas 50 operações de sync para diagnóstico
db.version(16).stores({
    // Tabelas do salão (com campos de conflito)
    pedidos: 'id, comanda_id, produto_id, status_cozinha, sincronizado, criado_em, impresso_local, sync_status, atualizado_em',
    comandas: 'id, mesa_id, empresa_id, status, sincronizado, criado_em, sync_status, atualizado_em',
    produtos: 'id, nome, preco, categoria_id, empresa_id, ativo, sincronizado, sync_status',
    categorias: 'id, nome, empresa_id, ordem, ativo, sincronizado, sync_status',
    mesas: 'id, numero_mesa, numero, status, empresa_id, sincronizado, sync_status',
    caixa: 'id, data_abertura, valor_abertura, status, empresa_id, sincronizado, sync_status',
    movimentacoes_caixa: 'id, caixa_id, tipo, valor, descricao, sincronizado, sync_status, atualizado_em',
    vendas_concluidas: 'id, comanda_id, mesa_id, valor_total, empresa_id, sincronizado, sync_status, atualizado_em',
    empresa: 'id, nome, cnpj, sincronizado, sync_status',
    chamadas_garcom: 'id, mesa_id, empresa_id, status, sincronizado, sync_status, atualizado_em',
    // Tabelas de delivery
    pedidos_delivery: 'id, empresa_id, user_id, status, total, sincronizado, sync_status, atualizado_em',
    itens_delivery: 'id, pedido_delivery_id, produto_id, sincronizado, sync_status',
    // Tabela de itens do pedido (para operações atômicas)
    itens_pedido: 'id, pedido_id, produto_id, quantidade, sincronizado, sync_status',
    // Tabelas de marketing
    cupons: 'id, empresa_id, codigo, ativo, sincronizado, sync_status',
    fidelidade_config: 'id, empresa_id, sincronizado, sync_status',
    combos: 'id, empresa_id, nome, ativo, sincronizado, sync_status',
    promocoes: 'id, empresa_id, nome, ativo, sincronizado, sync_status',
    // Tabela de equipe
    team_members: 'id, empresa_id, nome, email, sincronizado, sync_status',
    // Cache de usuários para login offline SEGURO
    // session_hash = hash SHA-256 da senha (NÃO a senha em texto)
    // permissions = objeto JSON com permissões do role
    // last_online_at = última vez que conectou online (para revalidação)
    // session_expires_at = expiração da sessão (24h)
    users_cache: 'email, id, nome, empresa_id, role, session_hash, cached_at, last_online_at, session_expires_at',
    // Carrinho offline-first: cada item persiste em IndexedDB (não depende de RAM)
    cart: '++id, cartKey, empresa_id, mesa_id',
    // Logs de sincronização para auditoria e suporte técnico
    // Mantém as últimas 50 operações de sync para diagnóstico remoto
    logs_sincronizacao: '++id, timestamp, type, operation, table, recordId',
});

// 2. DOWNLOAD INICIAL POR LOTES PRIORIZADOS (POPULAR O PC DO RESTAURANTE)
// P1 (imediato): mesas + empresa (< 50 registros, essencial para UI)
// P2 (background): produtos + categorias (cardápio)
// P3 (background): pedidos + comandas dos últimos 7 dias apenas
async function baixarLote(tabelas, empresaId, supabaseClient) {
    await Promise.all(tabelas.map(async (tabela) => {
        try {
            let query = supabaseClient.from(tabela.nome).select('*');
            if (tabela.filtro) query = query.eq(tabela.filtro, empresaId);
            if (tabela.dateFilter) {
                const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                query = query.gte(tabela.dateFilter, since);
            }
            const { data, error } = await query;
            if (!error && data && db[tabela.nome]) {
                if (tabela.filtro) {
                    const existentes = await db[tabela.nome].where(tabela.filtro).equals(empresaId).toArray();
                    const ids = existentes.map(e => e.id);
                    if (ids.length > 0) await db[tabela.nome].bulkDelete(ids);
                }
                const dadosComSync = data.map(item => ({
                    ...item,
                    sincronizado: 1,
                    numero: item.numero_mesa || item.numero
                }));
                await db[tabela.nome].bulkPut(dadosComSync);
            }
        } catch (e) {
            console.error(`Erro ao baixar ${tabela.nome}:`, e);
        }
    }));
}

export async function baixarDadosIniciais(empresaId, supabaseClient = supabase) {
    if (!navigator.onLine || !empresaId) return;

    console.log("📥 [P1] Baixando mesas e empresa...");
    // P1 — Dados essenciais para renderização imediata
    await baixarLote([
        { nome: 'mesas', filtro: 'empresa_id' },
        { nome: 'empresa', filtro: 'id' },
    ], empresaId, supabaseClient);
    console.log("✅ [P1] Mesas e empresa prontos!");

    // P2 + P3 — Rodam em paralelo, sem bloquear a UI
    console.log("📥 [P2+P3] Baixando cardápio e pedidos recentes...");
    baixarLote([
        { nome: 'produtos', filtro: 'empresa_id' },
        { nome: 'categorias', filtro: 'empresa_id' },
        { nome: 'comandas', filtro: 'empresa_id', dateFilter: 'criado_em' },
        { nome: 'pedidos', filtro: null, dateFilter: 'criado_em' },
    ], empresaId, supabaseClient).then(() => {
        console.log("✅ [P2+P3] Cardápio e pedidos recentes prontos!");
    }).catch(e => console.warn('[P2+P3] Erro parcial:', e));
}

// 3. FUNÇÃO GENÉRICA PARA SALVAR
export async function salvarLocal(tabela, dados) {
    const registro = {
        ...dados,
        sincronizado: 0,
        atualizado_em: new Date().toISOString()
    };
    return await db[tabela].put(registro);
}

// 4. SINCRONIZADOR GLOBAL (ENVIO)
export async function sincronizarTudo(supabaseClient = supabase) {
    if (!navigator.onLine) {
        console.log('[Sync] Offline - sincronização adiada');
        return { success: false, synced: 0, errors: 0 };
    }
    
    // Verificar se o Supabase está acessível antes de tentar sincronizar
    try {
        const testResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://tqmunlilydcowndqxiir.supabase.co'}/rest/v1/`, {
            method: 'HEAD',
            headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
            }
        });
        if (!testResponse.ok && testResponse.status !== 401) {
            console.log('[Sync] Supabase não acessível - sincronização adiada');
            return { success: false, synced: 0, errors: 0 };
        }
    } catch (e) {
        console.log('[Sync] Erro ao verificar conexão com Supabase - sincronização adiada');
        return { success: false, synced: 0, errors: 0 };
    }
    
    const tabelas = [
        'pedidos', 
        'produtos', 
        'categorias', 
        'mesas', 
        'comandas', 
        'movimentacoes_caixa', 
        'vendas_concluidas',
        'chamadas_garcom',
        'pedidos_delivery',
        'itens_delivery'
    ];

    let totalSincronizados = 0;
    let totalErros = 0;

    for (const nomeTabela of tabelas) {
        if (!db[nomeTabela]) continue;
        
        try {
            const pendentes = await db[nomeTabela].where('sincronizado').equals(0).toArray();

            if (pendentes.length > 0) {
                console.log(`[Sync] Sincronizando ${pendentes.length} registros de ${nomeTabela}...`);
                
                for (const item of pendentes) {
                    try {
                        const { sincronizado, numero, atualizado_em, criado_em, ...dadosParaSubir } = item;
                        
                        // Garantir que o ID está presente
                        if (!dadosParaSubir.id) {
                            console.warn(`[Sync] Item sem ID em ${nomeTabela}, pulando...`);
                            continue;
                        }
                        
                        const { error } = await supabaseClient
                            .from(nomeTabela)
                            .upsert([dadosParaSubir], { onConflict: 'id' });

                        if (!error) {
                            await db[nomeTabela].update(item.id, { sincronizado: 1 });
                            totalSincronizados++;
                            console.log(`[Sync] ✓ ${nomeTabela}/${item.id} sincronizado`);
                        } else {
                            totalErros++;
                            console.warn(`[Sync] ✗ Erro em ${nomeTabela}/${item.id}:`, error.message || error);
                        }
                    } catch (e) {
                        totalErros++;
                        console.error(`[Sync] ✗ Exceção ao sincronizar item de ${nomeTabela}:`, e.message || e);
                    }
                }
            }
        } catch (e) {
            console.error(`[Sync] Erro ao acessar ${nomeTabela}:`, e);
        }
    }
    
    console.log(`[Sync] ✅ Sincronização concluída: ${totalSincronizados} sincronizados, ${totalErros} erros`);
    return { success: totalErros === 0, synced: totalSincronizados, errors: totalErros };
}

// 5. VERIFICAR PENDÊNCIAS DE SINCRONIZAÇÃO
// Retorna o número total de registros pendentes
export async function verificarPendencias() {
    let total = 0;
    const tabelas = [
        'pedidos', 
        'produtos', 
        'categorias', 
        'mesas', 
        'comandas', 
        'movimentacoes_caixa', 
        'vendas_concluidas',
        'chamadas_garcom',
        'pedidos_delivery',
        'itens_delivery'
    ];
    
    for (const tabela of tabelas) {
        if (db[tabela]) {
            try {
                const count = await db[tabela].where('sincronizado').equals(0).count();
                total += count;
            } catch (e) {
                // tabela pode não existir ainda
            }
        }
    }
    
    return total;
}

// 6. CACHE DE USUÁRIO PARA LOGIN OFFLINE
// IMPORTANTE: Use as funções de offlineAuth.ts para autenticação segura!
// Estas funções são mantidas para compatibilidade básica.

// Salva dados do usuário no cache local após login bem-sucedido
// NOTA: Para login seguro com hash, use saveUserToCache de offlineAuth.ts
export async function salvarUsuarioCache(userData) {
    if (!userData?.email) return;
    
    try {
        const now = new Date().toISOString();
        const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
        
        await db.users_cache.put({
            email: userData.email.toLowerCase(),
            id: userData.id,
            nome: userData.nome || userData.email.split('@')[0],
            empresa_id: userData.empresa_id || null,
            role: userData.role || 'proprietario',
            session_hash: userData.session_hash || '', // Hash será preenchido por offlineAuth
            cached_at: now,
            last_online_at: now,
            session_expires_at: sessionExpires
        });
        console.log('[Cache] Usuário salvo para login offline:', userData.email);
    } catch (e) {
        console.error('[Cache] Erro ao salvar usuário:', e);
    }
}

// Busca usuário no cache local para login offline
// NOTA: Para validação segura, use validateOfflineLogin de offlineAuth.ts
export async function buscarUsuarioCache(email) {
    if (!email) return null;
    
    try {
        const usuario = await db.users_cache.get(email.toLowerCase());
        if (usuario) {
            console.log('[Cache] Usuário encontrado no cache local:', email);
            return usuario;
        }
    } catch (e) {
        console.error('[Cache] Erro ao buscar usuário:', e);
    }
    return null;
}

// Verifica se o usuário tem acesso offline (já fez login antes)
export async function verificarAcessoOffline(email) {
    const usuario = await buscarUsuarioCache(email);
    if (!usuario) return false;
    
    // Verificar se a sessão não expirou (máximo 7 dias offline)
    const lastOnline = new Date(usuario.last_online_at || usuario.cached_at);
    const daysSinceLastOnline = Math.floor(
        (Date.now() - lastOnline.getTime()) / (24 * 60 * 60 * 1000)
    );
    
    return daysSinceLastOnline <= 7;
}

// Atualiza o timestamp de última conexão online
export async function atualizarUltimaConexao(email) {
    if (!email) return;
    
    try {
        const usuario = await db.users_cache.get(email.toLowerCase());
        if (usuario) {
            await db.users_cache.update(email.toLowerCase(), {
                last_online_at: new Date().toISOString(),
                session_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
            console.log('[Cache] Timestamp atualizado:', email);
        }
    } catch (e) {
        console.error('[Cache] Erro ao atualizar timestamp:', e);
    }
}