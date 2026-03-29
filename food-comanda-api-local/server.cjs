const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// --- 🛠️ CONFIGURAÇÃO ---
const SUPABASE_URL = "https://zlwpxflqtyhdwanmupgy.supabase.co";
const SUPABASE_KEY = "SUA_KEY_AQUI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const db = new sqlite3.Database('./banco-local.sqlite');
const EMPRESA_ID = "0b49e4e3-72d8-461d-b70a-f3f53b8ba80b";

// --- 🗄️ SCHEMA DE PARIDADE TOTAL ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS mesas (id TEXT PRIMARY KEY, numero_mesa INTEGER, status TEXT, capacidade INTEGER, mesa_juncao_id TEXT, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS categorias (id TEXT PRIMARY KEY, nome TEXT, ordem INTEGER, ativo INTEGER, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS produtos (id TEXT PRIMARY KEY, nome TEXT, preco REAL, categoria_id TEXT, imagem_url TEXT, ativo INTEGER, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS equipe (id TEXT PRIMARY KEY, nome TEXT, email TEXT, senha_hash TEXT, cargo TEXT, ativo INTEGER, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS comandas (id TEXT PRIMARY KEY, mesa_id TEXT, empresa_id TEXT, status TEXT, nome_cliente TEXT, total REAL DEFAULT 0, sincronizado INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, comanda_id TEXT, produto_id TEXT, quantidade REAL, preco_unitario REAL, subtotal REAL, notas_cliente TEXT, status_cozinha TEXT, sincronizado INTEGER DEFAULT 0)`);
});

// --- 📥 DOWNLOAD: O ESPELHAMENTO ---
async function baixarTudoDaNuvem() {
    console.log("📥 [Mirror] Sincronizando dados do Supabase...");
    try {
        const tabelas = ['mesas', 'categorias', 'produtos', 'equipe'];
        for (const tabela of tabelas) {
            const { data } = await supabase.from(tabela).select('*').eq('empresa_id', EMPRESA_ID);
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
    } catch (e) { console.log("⚠️ [Offline] Usando dados locais existentes."); }
}

// --- 📤 UPLOAD: SINCRONIZAÇÃO REVERSA ---
async function subirDadosParaNuvem() {
    db.all(`SELECT * FROM comandas WHERE sincronizado = 0`, async (err, rows) => {
        if (rows?.length > 0) {
            for (const row of rows) {
                const { sincronizado, ...dadosParaNuvem } = row;
                const { error } = await supabase.from('comandas').upsert(dadosParaNuvem);
                if (!error) db.run(`UPDATE comandas SET sincronizado = 1 WHERE id = ?`, [row.id]);
            }
        }
    });

    db.all(`SELECT * FROM pedidos WHERE sincronizado = 0`, async (err, rows) => {
        if (rows?.length > 0) {
            for (const row of rows) {
                const { data: cmd } = await supabase.from('comandas').select('id').eq('id', row.comanda_id).maybeSingle();
                if (cmd) {
                    const { sincronizado, ...dadosParaNuvem } = row;
                    const { error } = await supabase.from('pedidos').upsert(dadosParaNuvem);
                    if (!error) db.run(`UPDATE pedidos SET sincronizado = 1 WHERE id = ?`, [row.id]);
                }
            }
        }
    });
}

baixarTudoDaNuvem();
setInterval(subirDadosParaNuvem, 10000);

// --- 📊 API LOCAL ---

// 1. Status Geral (Dashboard e Menu)
app.get('/api/local/status-geral', (req, res) => {
    db.all(`SELECT * FROM mesas ORDER BY numero_mesa`, (err, mesas) => {
        db.all(`SELECT * FROM comandas WHERE status = 'aberta'`, (err2, comandas) => {
            res.json({ mesas, comandas });
        });
    });
});

// 2. Cardápio (Menu)
app.get('/api/local/cardapio', (req, res) => {
    db.all(`SELECT * FROM produtos WHERE ativo = 1`, (err, produtos) => {
        db.all(`SELECT * FROM categorias WHERE ativo = 1 ORDER BY ordem`, (err2, categorias) => {
            res.json({ produtos, categorias });
        });
    });
});

// 3. Abrir Comanda
app.post('/api/local/abrir-comanda', (req, res) => {
    const { id, mesa_id, nome_cliente } = req.body;
    db.serialize(() => {
        db.run(`INSERT INTO comandas (id, mesa_id, empresa_id, status, nome_cliente) VALUES (?, ?, ?, 'aberta', ?)`,
            [id, mesa_id, EMPRESA_ID, nome_cliente]);
        db.run(`UPDATE mesas SET status = 'ocupada' WHERE id = ?`, [mesa_id]);
        res.json({ success: true });
    });
});

// 4. Realizar Pedidos (Carrinho)
app.post('/api/local/realizar-pedido', (req, res) => {
    const { pedidos } = req.body;
    const stmt = db.prepare(`INSERT INTO pedidos (id, comanda_id, produto_id, quantidade, preco_unitario, subtotal, notas_cliente, status_cozinha) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')`);
    db.serialize(() => {
        pedidos.forEach(p => stmt.run([p.id, p.comanda_id, p.produto_id, p.quantidade, p.preco_unitario, p.subtotal, p.notas_cliente]));
        stmt.finalize();
        res.json({ success: true });
    });
});

// 5. Criar Mesa (Dashboard Admin)
app.post('/api/local/mesas', (req, res) => {
    const { id, numero_mesa, capacidade } = req.body;
    db.run(`INSERT INTO mesas (id, numero_mesa, capacidade, status, empresa_id) VALUES (?, ?, ?, 'disponivel', ?)`,
        [id, numero_mesa, capacidade, EMPRESA_ID], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
});

// 6. Juntar Mesas
app.post('/api/local/mesas/juntar', (req, res) => {
    const { masterMesaId, otherMesaIds } = req.body;
    db.serialize(() => {
        db.run(`UPDATE mesas SET status = 'ocupada' WHERE id = ?`, [masterMesaId]);
        otherMesaIds.forEach(id => {
            db.run(`UPDATE mesas SET status = 'juncao', mesa_juncao_id = ? WHERE id = ?`, [masterMesaId, id]);
        });
        res.json({ success: true });
    });
});

// 7. Separar Mesa
app.post('/api/local/mesas/separar', (req, res) => {
    const { mesaId } = req.body;
    db.run(`UPDATE mesas SET status = 'disponivel', mesa_juncao_id = NULL WHERE id = ?`, [mesaId], (err) => {
        res.json({ success: !err });
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 SERVIDOR HÍBRIDO RODANDO NA PORTA 3000'));