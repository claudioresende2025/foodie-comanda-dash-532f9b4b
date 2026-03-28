import Dexie from 'dexie';

// 1. CONFIGURAÇÃO DO BANCO LOCAL (INDEXEDDB)
export const db = new Dexie('FoodComandaPro_DB');

db.version(2).stores({
    pedidos: '++id, mesa_id, total, status, sincronizado, criado_em',
    produtos: 'id, nome, preco, categoria_id, sincronizado',
    categorias: 'id, nome, sincronizado',
    mesas: 'id, numero, status, sincronizado',
    caixa: '++id, data_abertura, valor_abertura, status, sincronizado',
    movimentacoes_caixa: '++id, caixa_id, tipo, valor, descricao, sincronizado',
    empresa: 'id, nome, cnpj'
});

// 2. DOWNLOAD INICIAL (POPULAR O PC DO RESTAURANTE)
export async function baixarDadosIniciais(supabaseClient, empresaId) {
    if (!navigator.onLine || !empresaId) return;

    console.log("📥 Atualizando banco local com dados da nuvem...");
    const tabelasParaBaixar = ['produtos', 'categorias', 'mesas', 'empresa'];

    for (const tabela of tabelasParaBaixar) {
        try {
            const { data, error } = await supabaseClient
                .from(tabela)
                .select('*')
                .eq('empresa_id', empresaId);

            if (!error && data) {
                await db[tabela].clear();
                const dadosComSync = data.map(item => ({ ...item, sincronizado: 1 }));
                await db[tabela].bulkAdd(dadosComSync);
            }
        } catch (e) {
            console.error(`Erro ao baixar ${tabela}:`, e);
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
    return await db[tabela].add(registro);
}

// 4. SINCRONIZADOR GLOBAL (ENVIO)
export async function sincronizarTudo(supabaseClient) {
    const tabelas = ['pedidos', 'produtos', 'caixa', 'mesas'];

    for (const nomeTabela of tabelas) {
        const pendentes = await db[nomeTabela].where('sincronizado').equals(0).toArray();

        if (pendentes.length > 0) {
            for (const item of pendentes) {
                try {
                    const { id, sincronizado, ...dadosParaSubir } = item;
                    const { error } = await supabaseClient
                        .from(nomeTabela)
                        .upsert([dadosParaSubir]);

                    if (!error) {
                        await db[nomeTabela].update(item.id, { sincronizado: 1 });
                    }
                } catch (e) {
                    console.error(`Erro ao sincronizar ${nomeTabela}:`, e);
                }
            }
        }
    }
}