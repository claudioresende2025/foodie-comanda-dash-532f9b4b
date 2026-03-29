const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// --- 🛠️ CONFIGURAÇÃO DE CONEXÃO ---
const SUPABASE_URL = "https://zlwpxflqtyhdwanmupgy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw";

const db = new sqlite3.Database('./banco-local.sqlite');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const EMPRESA_ID = "0b49e4e3-72d8-461d-b70a-f3f53b8ba80b";

// --- 🗄️ CRIAÇÃO DAS TABELAS DE ESPELHAMENTO ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS mesas (id TEXT PRIMARY KEY, numero_mesa INTEGER, status TEXT, empresa_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS categorias (id TEXT PRIMARY KEY, nome TEXT, ordem INTEGER, ativo INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS produtos (id TEXT PRIMARY KEY, nome TEXT, preco REAL, categoria_id TEXT, imagem_url TEXT, ativo INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS equipe (id TEXT PRIMARY KEY, email TEXT, senha_hash TEXT, nome TEXT, cargo TEXT, ativo INTEGER)`);

    // Movimentação com flag de sincronização
    db.run(`CREATE TABLE IF NOT EXISTS comandas (id TEXT PRIMARY KEY, mesa_id TEXT, empresa_id TEXT, status TEXT, nome_cliente TEXT, total REAL DEFAULT 0, sincronizado INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, comanda_id TEXT, produto_id TEXT, quantidade REAL, preco_unitario REAL, subtotal REAL, notas_cliente TEXT, sincronizado INTEGER DEFAULT 0)`);
});

// --- 📥 DOWNLOAD: NUVEM -> LOCAL ---
async function sincronizarEstruturaDaNuvem() {
    console.log("🔄 [Download] Sincronizando estrutura do Supabase...");
    try {
        const { data: mesas } = await supabase.from('mesas').select('*').eq('empresa_id', EMPRESA_ID);
        if (mesas) mesas.forEach(m => db.run(`INSERT OR REPLACE INTO mesas (id, numero_mesa, status, empresa_id) VALUES (?, ?, ?, ?)`, [m.id, m.numero_mesa, m.status, m.empresa_id]));

        const { data: cats } = await supabase.from('categorias').select('*').eq('empresa_id', EMPRESA_ID);
        if (cats) cats.forEach(c => db.run(`INSERT OR REPLACE INTO categorias (id, nome, ordem, ativo) VALUES (?, ?, ?, ?)`, [c.id, c.nome, c.ordem, c.ativo ? 1 : 0]));

        const { data: prods } = await supabase.from('produtos').select('*').eq('empresa_id', EMPRESA_ID);
        if (prods) prods.forEach(p => db.run(`INSERT OR REPLACE INTO produtos (id, nome, preco, categoria_id, imagem_url, ativo) VALUES (?, ?, ?, ?, ?, ?)`, [p.id, p.nome, p.preco, p.categoria_id, p.imagem_url, p.ativo ? 1 : 0]));

        const { data: equipe } = await supabase.from('equipe').select('*').eq('empresa_id', EMPRESA_ID);
        if (equipe) equipe.forEach(u => db.run(`INSERT OR REPLACE INTO equipe (id, email, senha_hash, nome, cargo, ativo) VALUES (?, ?, ?, ?, ?, ?)`, [u.id, u.email, u.senha_hash, u.nome, u.cargo, u.ativo ? 1 : 0]));

        console.log("✅ [Download] Dados locais atualizados.");
    } catch (e) { console.log("⚠️ [Download] Servidor em modo offline."); }
}

// --- 📤 UPLOAD: LOCAL -> NUVEM (ROBÔ DE SINCRONIZAÇÃO) ---
async function sincronizarMovimentacaoParaNuvem() {
    try {
        // 1. Sincronizar Comandas primeiro (Obrigatório para evitar erro de FK nos pedidos)
        db.all(`SELECT * FROM comandas WHERE sincronizado = 0`, async (err, comandas) => {
            if (!comandas || comandas.length === 0) return;

            for (const cmd of comandas) {
                const { error } = await supabase.from('comandas').upsert({
                    id: cmd.id, mesa_id: cmd.mesa_id, empresa_id: cmd.empresa_id, status: cmd.status, nome_cliente: cmd.nome_cliente, total: cmd.total
                });
                if (!error) db.run(`UPDATE comandas SET sincronizado = 1 WHERE id = ?`, [cmd.id]);
            }
        });

        // 2. Sincronizar Pedidos
        db.all(`SELECT * FROM pedidos WHERE sincronizado = 0`, async (err, pedidos) => {
            if (!pedidos || pedidos.length === 0) return;

            for (const ped of pedidos) {
                // Verifica se a comanda já existe na nuvem antes de enviar o pedido
                const { data: check } = await supabase.from('comandas').select('id').eq('id', ped.comanda_id).maybeSingle();
                if (check) {
                    const { error } = await supabase.from('pedidos').insert({
                        id: ped.id, comanda_id: ped.comanda_id, produto_id: ped.produto_id,
                        quantidade: ped.quantidade, preco_unitario: ped.preco_unitario,
                        subtotal: ped.subtotal, notas_cliente: ped.notas_cliente
                    });
                    if (!error) db.run(`UPDATE pedidos SET sincronizado = 1 WHERE id = ?`, [ped.id]);
                }
            }
        });
    } catch (e) { /* Silêncio se falhar a rede */ }
}

// Ciclos de execução
sincronizarEstruturaDaNuvem();
setInterval(sincronizarEstruturaDaNuvem, 30 * 60 * 1000); // Cada 30 min
setInterval(sincronizarMovimentacaoParaNuvem, 10000); // Cada 10 seg

// --- 📊 API LOCAL PARA O REACT ---
app.get('/api/local/status-geral', (req, res) => {
    db.all(`SELECT * FROM mesas`, (err, mesas) => {
        db.all(`SELECT * FROM comandas WHERE status = 'aberta'`, (err, comandas) => {
            res.json({ mesas, comandas_ativas: comandas });
        });
    });
});

app.get('/api/local/cardapio', (req, res) => {
    db.all(`SELECT * FROM produtos WHERE ativo = 1`, (err, produtos) => {
        db.all(`SELECT * FROM categorias WHERE ativo = 1 ORDER BY ordem`, (err, categorias) => {
            res.json({ produtos, categorias });
        });
    });
});

app.post('/api/local/login', (req, res) => {
    const { email, senha } = req.body;
    db.get(`SELECT * FROM equipe WHERE email = ? AND senha_hash = ? AND ativo = 1`, [email, senha], (err, user) => {
        if (user) res.json({ success: true, user });
        else res.status(401).json({ success: false });
    });
});

// --- 🚀 START ---
app.listen(3000, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR HÍBRIDO ATIVO - IP: 192.168.2.111');
});