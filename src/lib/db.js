import Dexie from 'dexie';

// 1. CONFIGURAÇÃO DO BANCO LOCAL (INDEXEDDB)
export const db = new Dexie('FoodComandaPro_DB');

db.version(3).stores({
    pedidos: 'id, comanda_id, produto_id, status, sincronizado, criado_em',
    comandas: 'id, mesa_id, empresa_id, status, sincronizado, criado_em',
    produtos: 'id, nome, preco, categoria_id, empresa_id, ativo, sincronizado',
    categorias: 'id, nome, empresa_id, ordem, ativo, sincronizado',
    mesas: 'id, numero_mesa, numero, status, empresa_id, sincronizado',
    caixa: 'id, data_abertura, valor_abertura, status, empresa_id, sincronizado',
    movimentacoes_caixa: 'id, caixa_id, tipo, valor, descricao, sincronizado',
    vendas_concluidas: 'id, comanda_id, mesa_id, valor_total, empresa_id, sincronizado',
    empresa: 'id, nome, cnpj, sincronizado',
    chamadas_garcom: 'id, mesa_id, empresa_id, status, sincronizado'
});

// 2. DOWNLOAD INICIAL (POPULAR O PC DO RESTAURANTE)
export async function baixarDadosIniciais(supabaseClient, empresaId) {
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
export async function sincronizarTudo(supabaseClient) {
    if (!navigator.onLine) {
        console.log('[Sync] Offline - sincronização adiada');
        return;
    }
    
    const tabelas = ['pedidos', 'produtos', 'categorias', 'mesas', 'comandas', 'movimentacoes_caixa', 'vendas_concluidas'];

    for (const nomeTabela of tabelas) {
        if (!db[nomeTabela]) continue;
        
        try {
            const pendentes = await db[nomeTabela].where('sincronizado').equals(0).toArray();

            if (pendentes.length > 0) {
                console.log(`[Sync] Sincronizando ${pendentes.length} registros de ${nomeTabela}...`);
                
                for (const item of pendentes) {
                    try {
                        const { sincronizado, numero, atualizado_em, ...dadosParaSubir } = item;
                        const { error } = await supabaseClient
                            .from(nomeTabela)
                            .upsert([dadosParaSubir], { onConflict: 'id' });

                        if (!error) {
                            await db[nomeTabela].update(item.id, { sincronizado: 1 });
                        } else {
                            console.warn(`[Sync] Erro em ${nomeTabela}:`, error);
                        }
                    } catch (e) {
                        console.error(`[Sync] Erro ao sincronizar item de ${nomeTabela}:`, e);
                    }
                }
            }
        } catch (e) {
            console.error(`[Sync] Erro ao acessar ${nomeTabela}:`, e);
        }
    }
    
    console.log('[Sync] ✅ Sincronização concluída');
}

// 5. VERIFICAR PENDÊNCIAS DE SINCRONIZAÇÃO
export async function verificarPendencias() {
    const pendencias = {};
    const tabelas = ['pedidos', 'produtos', 'categorias', 'mesas', 'comandas'];
    
    for (const tabela of tabelas) {
        if (db[tabela]) {
            try {
                const count = await db[tabela].where('sincronizado').equals(0).count();
                if (count > 0) pendencias[tabela] = count;
            } catch (e) {
                // tabela pode não existir ainda
            }
        }
    }
    
    return pendencias;
}