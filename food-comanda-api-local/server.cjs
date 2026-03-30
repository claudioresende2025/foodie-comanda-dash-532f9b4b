const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ✅ CORREÇÃO CORS: Aberto para aceitar requisições do Frontend
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-client-info']
}));

app.use(express.json());

// --- 🛠️ CONFIGURAÇÃO ---
const SUPABASE_URL = "https://zlwpxflqtyhdwanmupgy.supabase.co";
// 🚨 LEMBRE-SE: Use sua SERVICE_ROLE_KEY aqui
const SUPABASE_KEY = "COLE_AQUI_SUA_SERVICE_ROLE_KEY";
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

// --- 📥 DOWNLOAD: NUVEM -> LOCAL (Sincroniza Equipe para o Login Offline) ---
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
        console.log("✅ [Mirror] Banco local atualizado com sucesso.");
    } catch (e) {
        console.log("⚠️ [Mirror] Modo Offline: Usando cache local.");
    }
}

// --- 📤 UPLOAD: LOCAL -> NUVEM ---
async function subirDadosParaNuvem() {
    db.all(`SELECT * FROM comandas WHERE sincronizado = 0`, async (err, rows) => {
        if (rows && rows.length > 0) {
            for (const row of rows) {
                const { sincronizado, ...dadosParaNuvem } = row;
                const { error } = await supabase.from('comandas').upsert(dadosParaNuvem);
                if (!error) db.run(`UPDATE comandas SET sincronizado = 1 WHERE id = ?`, [row.id]);
            }
        }
    });
}

baixarTudoDaNuvem();
setInterval(subirDadosParaNuvem, 10000);

// --- 📊 API LOCAL PARA O FRONTEND ---

// 1. LOGIN DE CONTINGÊNCIA (Permite logar sem internet)
app.post('/api/local/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM equipe WHERE email = ? AND ativo = 1`, [email], (err, row) => {
        if (row) {
            res.json({
                success: true,
                user: { id: row.id, email: row.email, nome: row.nome, cargo: row.cargo }
            });
        } else {
            res.status(401).json({ success: false, message: "Usuário não encontrado localmente" });
        }
    });
});

// 2. BUSCA DE EMPRESA (Evita tela branca offline)
app.get('/api/local/empresa-auth/:nome', (req, res) => {
    res.json({ id: EMPRESA_ID, nome_fantasia: "Modo Offline Ativo" });
});

// 3. STATUS GERAL
app.get('/api/local/status-geral', (req, res) => {
    db.all(`SELECT * FROM mesas ORDER BY numero_mesa`, (err, mesas) => {
        db.all(`SELECT * FROM comandas WHERE status = 'aberta'`, (err2, comandas) => {
            res.json({ mesas: mesas || [], comandas: comandas || [] });
        });
    });
});

// 4. ABRIR COMANDA
app.post('/api/local/abrir-comanda', (req, res) => {
    const { id, mesa_id, nome_cliente } = req.body;
    const agora = new Date().toISOString();
    db.serialize(() => {
        db.run(`INSERT INTO comandas (id, mesa_id, empresa_id, status, nome_cliente, created_at, sincronizado) VALUES (?, ?, ?, 'aberta', ?, ?, 0)`,
            [id, mesa_id, EMPRESA_ID, nome_cliente, agora]);
        db.run(`UPDATE mesas SET status = 'ocupada' WHERE id = ?`, [mesa_id]);
        res.json({ success: true });
    });
});

// 5. FECHAR COMANDA
app.post('/api/local/comanda/fechar', (req, res) => {
    const { id, total, mesa_id } = req.body;
    db.serialize(() => {
        db.run(`UPDATE comandas SET status = 'fechada', total = ?, sincronizado = 0 WHERE id = ?`, [total, id]);
        db.run(`UPDATE mesas SET status = 'disponivel', sincronizado = 0 WHERE id = ?`, [mesa_id]);
        res.json({ success: true });
    });
});

// 6. REALIZAR PEDIDO
app.post('/api/local/realizar-pedido', (req, res) => {
    const { pedidos } = req.body;
    const agora = new Date().toISOString();
    const stmt = db.prepare(`INSERT INTO pedidos (id, comanda_id, produto_id, quantidade, preco_unitario, subtotal, notas_cliente, status_cozinha, created_at, sincronizado) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, 0)`);
    db.serialize(() => {
        pedidos.forEach(p => stmt.run([p.id, p.comanda_id, p.produto_id, p.quantidade, p.preco_unitario, p.subtotal, p.notas_cliente, agora]));
        stmt.finalize();
        res.json({ success: true });
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 SERVIDOR HÍBRIDO RODANDO NA PORTA 3000'));