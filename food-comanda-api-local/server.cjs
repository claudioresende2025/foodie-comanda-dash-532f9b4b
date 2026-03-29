const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ✅ CORREÇÃO CORS: Totalmente aberto para evitar bloqueios de HTTPS/HTTP do Chrome
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-client-info']
}));

app.use(express.json());

// --- 🛠️ CONFIGURAÇÃO ---
const SUPABASE_URL = "https://zlwpxflqtyhdwanmupgy.supabase.co";
// 🚨 IMPORTANTE: Substitua pela SERVICE_ROLE (Secret) Key do seu painel Supabase
const SUPABASE_KEY = "SUA_SERVICE_ROLE_KEY_AQUI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const db = new sqlite3.Database('./banco-local.sqlite');
const EMPRESA_ID = "0b49e4e3-72d8-461d-b70a-f3f53b8ba80b";

// --- 🗄️ SCHEMA DE PARIDADE TOTAL ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS mesas (id TEXT PRIMARY KEY, numero_mesa INTEGER, status TEXT, capacidade INTEGER, mesa_juncao_id TEXT, empresa_id TEXT, sincronizado INTEGER DEFAULT 1)`);
    db.run(`CREATE TABLE IF NOT EXISTS categorias (id TEXT PRIMARY KEY, nome TEXT, ordem INTEGER, ativo INTEGER, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS produtos (id TEXT PRIMARY KEY, nome TEXT, preco REAL, categoria_id TEXT, imagem_url TEXT, ativo INTEGER, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS equipe (id TEXT PRIMARY KEY, nome TEXT, email TEXT, senha_hash TEXT, cargo TEXT, ativo INTEGER, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS comandas (id TEXT PRIMARY KEY, mesa_id TEXT, empresa_id TEXT, status TEXT, nome_cliente TEXT, total REAL DEFAULT 0, sincronizado INTEGER DEFAULT 0, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, comanda_id TEXT, produto_id TEXT, quantidade REAL, preco_unitario REAL, subtotal REAL, notas_cliente TEXT, status_cozinha TEXT, sincronizado INTEGER DEFAULT 0, created_at TEXT)`);
});

// --- 📥 DOWNLOAD: SINCRONIZAÇÃO NUVEM -> LOCAL ---
async function baixarTudoDaNuvem() {
    console.log("📥 [Mirror] Buscando snapshot da nuvem...");
    try {
        const tabelas = ['mesas', 'categorias', 'produtos', 'equipe'];
        for (const tabela of tabelas) {
            const { data, error } = await supabase.from(tabela).select('*').eq('empresa_id', EMPRESA_ID);
            if (error) throw error;
            if (data) {
                data.forEach(item => {
                    const keys = Object.keys(item).join(',');
                    const placeholders = Object.keys(item).map(() => '?').join(',');
                    const values = Object.values(item);
                    db.run(`INSERT OR REPLACE INTO ${tabela} (${keys}) VALUES (${placeholders})`, values);
                });
            }
        }
        console.log("✅ [Mirror] Banco local atualizado.");
    } catch (e) {
        console.log("⚠️ [Mirror] Modo Offline: Usando cache local.");
    }
}

// --- 📤 UPLOAD: SINCRONIZAÇÃO LOCAL -> NUVEM ---
async function subirDadosParaNuvem() {
    // 1. Sincroniza Comandas
    db.all(`SELECT * FROM comandas WHERE sincronizado = 0`, async (err, rows) => {
        if (rows && rows.length > 0) {
            for (const row of rows) {
                const { sincronizado, ...dadosParaNuvem } = row;
                const { error } = await supabase.from('comandas').upsert(dadosParaNuvem);
                if (!error) {
                    db.run(`UPDATE comandas SET sincronizado = 1 WHERE id = ?`, [row.id]);
                    console.log(`☁️ Sincronizado: Comanda ${row.id}`);
                } else {
                    console.error(`❌ Erro ao subir comanda ${row.id}:`, error.message);
                }
            }
        }
    });

    // 2. Sincroniza Pedidos
    db.all(`SELECT * FROM pedidos WHERE sincronizado = 0`, async (err, rows) => {
        if (rows && rows.length > 0) {
            for (const row of rows) {
                const { sincronizado, ...dadosParaNuvem } = row;
                const { error } = await supabase.from('pedidos').upsert(dadosParaNuvem);
                if (!error) {
                    db.run(`UPDATE pedidos SET sincronizado = 1 WHERE id = ?`, [row.id]);
                    console.log(`☁️ Sincronizado: Pedido ${row.id}`);
                } else {
                    console.error(`❌ Erro ao subir pedido ${row.id}:`, error.message);
                }
            }
        }
    });
}

baixarTudoDaNuvem();
setInterval(subirDadosParaNuvem, 10000);

// --- 📊 API LOCAL PARA O FRONTEND ---

app.get('/api/local/status-geral', (req, res) => {
    db.all(`SELECT * FROM mesas ORDER BY numero_mesa`, (err, mesas) => {
        db.all(`SELECT * FROM comandas WHERE status = 'aberta'`, (err2, comandas) => {
            res.json({ mesas: mesas || [], comandas: comandas || [] });
        });
    });
});

app.get('/api/local/cardapio', (req, res) => {
    db.all(`SELECT * FROM produtos WHERE ativo = 1`, (err, produtos) => {
        db.all(`SELECT * FROM categorias WHERE ativo = 1 ORDER BY ordem`, (err2, categorias) => {
            res.json({ produtos: produtos || [], categorias: categorias || [] });
        });
    });
});

app.post('/api/local/abrir-comanda', (req, res) => {
    const { id, mesa_id, nome_cliente } = req.body;
    const agora = new Date().toISOString();
    db.serialize(() => {
        db.run(`INSERT INTO comandas (id, mesa_id, empresa_id, status, nome_cliente, created_at, sincronizado) VALUES (?, ?, ?, 'aberta', ?, ?, 0)`,
            [id, mesa_id, EMPRESA_ID, nome_cliente, agora]);
        db.run(`UPDATE mesas SET status = 'ocupada' WHERE id = ?`, [mesa_id]);
        console.log(`📝 Local: Comanda aberta na mesa ${mesa_id}`);
        res.json({ success: true });
    });
});

app.post('/api/local/realizar-pedido', (req, res) => {
    const { pedidos } = req.body;
    const agora = new Date().toISOString();
    db.serialize(() => {
        const stmt = db.prepare(`INSERT INTO pedidos (id, comanda_id, produto_id, quantidade, preco_unitario, subtotal, notas_cliente, status_cozinha, created_at, sincronizado) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, 0)`);
        pedidos.forEach(p => stmt.run([p.id, p.comanda_id, p.produto_id, p.quantidade, p.preco_unitario, p.subtotal, p.notas_cliente, agora]));
        stmt.finalize();
        console.log(`📦 Local: ${pedidos.length} itens salvos no SQLite.`);
        res.json({ success: true });
    });
});

app.post('/api/local/mesas', (req, res) => {
    const { id, numero_mesa, capacidade } = req.body;
    db.run(`INSERT INTO mesas (id, numero_mesa, capacidade, status, empresa_id, sincronizado) VALUES (?, ?, ?, 'disponivel', ?, 0)`,
        [id, numero_mesa, capacidade, EMPRESA_ID], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            console.log(`🆕 Local: Mesa ${numero_mesa} criada.`);
            res.json({ success: true });
        });
});

app.post('/api/local/mesas/juntar', (req, res) => {
    const { masterMesaId, otherMesaIds } = req.body;
    db.serialize(() => {
        db.run(`UPDATE mesas SET status = 'ocupada', sincronizado = 0 WHERE id = ?`, [masterMesaId]);
        otherMesaIds.forEach(id => db.run(`UPDATE mesas SET status = 'juncao', mesa_juncao_id = ?, sincronizado = 0 WHERE id = ?`, [masterMesaId, id]));
        res.json({ success