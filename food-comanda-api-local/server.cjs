const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// --- 🛠️ CONFIGURAÇÃO ---
const SUPABASE_URL = "https://zlwpxflqtyhdwanmupgy.supabase.co";
const SUPABASE_KEY = "SUA_KEY_AQUI"; // Use sua Service Role Key se possível para evitar RLS offline
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const db = new sqlite3.Database('./banco-local.sqlite');
const EMPRESA_ID = "0b49e4e3-72d8-461d-b70a-f3f53b8ba80b";

// --- 🗄️ SCHEMA DE PARIDADE TOTAL ---
db.serialize(() => {
    // Estrutura (Nuvem -> Local)
    db.run(`CREATE TABLE IF NOT EXISTS mesas (id TEXT PRIMARY KEY, numero_mesa INTEGER, status TEXT, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS categorias (id TEXT PRIMARY KEY, nome TEXT, ordem INTEGER, ativo INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS produtos (id TEXT PRIMARY KEY, nome TEXT, preco REAL, categoria_id TEXT, imagem_url TEXT, ativo INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS equipe (id TEXT PRIMARY KEY, nome TEXT, email TEXT, senha_hash TEXT, cargo TEXT, ativo INTEGER)`);

    // Movimentação (Local -> Nuvem)
    db.run(`CREATE TABLE IF NOT EXISTS comandas (id TEXT PRIMARY KEY, mesa_id TEXT, empresa_id TEXT, status TEXT, nome_cliente TEXT, total REAL DEFAULT 0, sincronizado INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, comanda_id TEXT, produto_id TEXT, quantidade REAL, preco_unitario REAL, subtotal REAL, notas_cliente TEXT, status_cozinha TEXT, sincronizado INTEGER DEFAULT 0)`);
});

// --- 📥 DOWNLOAD: O ESPELHAMENTO (Mirroring) ---
async function baixarTudoDaNuvem() {
    console.log("📥 [Mirror] Baixando snapshot da nuvem...");
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
        console.log("✅ [Mirror] Banco local sincronizado com a nuvem.");
    } catch (e) { console.log("⚠️ [Mirror] Offline: Operando com dados locais."); }
}

// --- 📤 UPLOAD: O RETORNO (Sincronização Reversa) ---
async function subirDadosParaNuvem() {
    // 1. Sincroniza Comandas
    db.all(`SELECT * FROM comandas WHERE sincronizado = 0`, async (err, rows) => {
        if (rows?.length > 0) {
            for (const row of rows) {
                const { sincronizado, ...dadosParaNuvem } = row;
                const { error } = await supabase.from('comandas').upsert(dadosParaNuvem);
                if (!error) db.run(`UPDATE comandas SET sincronizado = 1 WHERE id = ?`, [row.id]);
            }
        }
    });

    // 2. Sincroniza Pedidos
    db.all(`SELECT * FROM pedidos WHERE sincronizado = 0`, async (err, rows) => {
        if (rows?.length > 0) {
            for (const row of rows) {
                // Garantia de integridade: Só sobe se a comanda já existir na nuvem
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

// Inicialização
baixarTudoDaNuvem();
setInterval(subirDadosParaNuvem, 10000); // Tenta subir a cada 10s

// --- 📊 API LOCAL PARA O FRONTEND (Respostas Imediatas) ---
app.get('/api/local/status-geral', (req, res) => {
    db.all(`SELECT * FROM mesas`, (err, mesas) => {
        db.all(`SELECT * FROM comandas WHERE status = 'aberta'`, (err, comandas) => {
            res.json({ mesas, comandas });
        });
    });
});

app.post('/api/local/abrir-comanda', (req, res) => {
    const { id, mesa_id, nome_cliente } = req.body;
    db.serialize(() => {
        db.run(`INSERT INTO comandas (id, mesa_id, empresa_id, status, nome_cliente) VALUES (?, ?, ?, 'aberta', ?)`,
            [id, mesa_id, EMPRESA_ID, nome_cliente]);
        db.run(`UPDATE mesas SET status = 'ocupada' WHERE id = ?`, [mesa_id]);
        res.json({ success: true });
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 SERVIDOR HÍBRIDO EM EXECUÇÃO'));