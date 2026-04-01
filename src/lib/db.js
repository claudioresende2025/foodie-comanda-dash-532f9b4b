import Dexie from 'dexie';
import { supabase } from '@/integrations/supabase/client';

// 1. CONFIGURAÇÃO DO BANCO LOCAL (INDEXEDDB)
export const db = new Dexie('FoodComandaPro_DB');

db.version(7).stores({
    // Tabelas do salão
    pedidos: 'id, comanda_id, produto_id, status_cozinha, sincronizado, criado_em',
    comandas: 'id, mesa_id, empresa_id, status, sincronizado, criado_em',
    produtos: 'id, nome, preco, categoria_id, empresa_id, ativo, sincronizado',
    categorias: 'id, nome, empresa_id, ordem, ativo, sincronizado',
    mesas: 'id, numero_mesa, numero, status, empresa_id, sincronizado',
    caixa: 'id, data_abertura, valor_abertura, status, empresa_id, sincronizado',
    movimentacoes_caixa: 'id, caixa_id, tipo, valor, descricao, sincronizado',
    vendas_concluidas: 'id, comanda_id, mesa_id, valor_total, empresa_id, sincronizado',
    empresa: 'id, nome, cnpj, sincronizado',
    chamadas_garcom: 'id, mesa_id, empresa_id, status, sincronizado',
    // Tabelas de delivery
    pedidos_delivery: 'id, empresa_id, user_id, status, total, sincronizado',
    itens_delivery: 'id, pedido_delivery_id, produto_id, sincronizado',
    // Tabelas de marketing
    cupons: 'id, empresa_id, codigo, ativo, sincronizado',
    fidelidade_config: 'id, empresa_id, sincronizado',
    combos: 'id, empresa_id, nome, ativo, sincronizado',
    promocoes: 'id, empresa_id, nome, ativo, sincronizado',
    // Tabela de equipe
    team_members: 'id, empresa_id, nome, email, sincronizado',
    // Cache de usuários para login offline (NÃO armazena senha - apenas email e dados do perfil)
    users_cache: 'email, id, nome, empresa_id, role, cached_at',
});

// 2. DOWNLOAD INICIAL (POPULAR O PC DO RESTAURANTE)
export async function baixarDadosIniciais(empresaId, supabaseClient = supabase) {
    if (!navigator.onLine || !empresaId) return;

    console.log("📥 Atualizando banco local com dados da nuvem...");
    const tabelasParaBaixar = [
        { nome: 'produtos', filtro: 'empresa_id' },
        { nome: 'categorias', filtro: 'empresa_id' },
        { nome: 'mesas', filtro: 'empresa_id' },
        { nome: 'comandas', filtro: 'empresa_id' },
        { nome: 'pedidos', filtro: null }, // Pedidos via join com comandas
    ];

    for (const tabela of tabelasParaBaixar) {
        try {
            let query = supabaseClient.from(tabela.nome).select('*');
            
            if (tabela.filtro) {
                query = query.eq(tabela.filtro, empresaId);
            }
            
            const { data, error } = await query;

            if (!error && data && db[tabela.nome]) {
                // Limpar dados antigos desta empresa
                if (tabela.filtro) {
                    const existentes = await db[tabela.nome].where(tabela.filtro).equals(empresaId).toArray();
                    const idsParaRemover = existentes.map(e => e.id);
                    if (idsParaRemover.length > 0) {
                        await db[tabela.nome].bulkDelete(idsParaRemover);
                    }
                }
                
                const dadosComSync = data.map(item => ({ 
                    ...item, 
                    sincronizado: 1,
                    numero: item.numero_mesa || item.numero // compatibilidade mesas
                }));
                await db[tabela.nome].bulkPut(dadosComSync);
            }
        } catch (e) {
            console.error(`Erro ao baixar ${tabela.nome}:`, e);
        }
    }
    console.log("✅ Banco local pronto para uso offline!");
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
// Salva dados do usuário no cache local após login bem-sucedido
export async function salvarUsuarioCache(userData) {
    if (!userData?.email) return;
    
    try {
        await db.users_cache.put({
            email: userData.email.toLowerCase(),
            id: userData.id,
            nome: userData.nome || userData.email.split('@')[0],
            empresa_id: userData.empresa_id || null,
            role: userData.role || 'proprietario',
            cached_at: new Date().toISOString()
        });
        console.log('[Cache] Usuário salvo para login offline:', userData.email);
    } catch (e) {
        console.error('[Cache] Erro ao salvar usuário:', e);
    }
}

// Busca usuário no cache local para login offline
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
    return usuario !== null;
}