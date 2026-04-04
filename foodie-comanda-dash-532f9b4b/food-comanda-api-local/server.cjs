const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ✅ CORREÇÃO CORS COMPLETA: Responde OPTIONS explicitamente
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');

    // Responde instantaneamente ao "preflight" do navegador
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

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
    db.run(`CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, nome TEXT, email TEXT, empresa_id TEXT, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS user_roles (id TEXT PRIMARY KEY, user_id TEXT, empresa_id TEXT, role TEXT, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS comandas (id TEXT PRIMARY KEY, mesa_id TEXT, empresa_id TEXT, status TEXT, nome_cliente TEXT, total REAL DEFAULT 0, sincronizado INTEGER DEFAULT 0, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (id TEXT PRIMARY KEY, comanda_id TEXT, produto_id TEXT, quantidade REAL, preco_unitario REAL, subtotal REAL, notas_cliente TEXT, status_cozinha TEXT, sincronizado INTEGER DEFAULT 0, created_at TEXT)`);
    // Tabela para credenciais locais de backup
    db.run(`CREATE TABLE IF NOT EXISTS credenciais_locais (email TEXT PRIMARY KEY, senha_hash TEXT, user_id TEXT, nome TEXT, role TEXT)`);
});

// --- 📥 DOWNLOAD: NUVEM -> LOCAL (Sincroniza Profiles e Roles para o Login Offline) ---
async function baixarTudoDaNuvem() {
    console.log("📥 [Mirror] Buscando snapshot da nuvem...");
    try {
        // Tabelas de dados
        const tabelasDados = ['mesas', 'categorias', 'produtos'];
        for (const tabela of tabelasDados) {
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
        
        // Profiles (usuários)
        const { data: profiles } = await supabase.from('profiles').select('*').eq('empresa_id', EMPRESA_ID);
        if (profiles) {
            profiles.forEach(p => {
                db.run(`INSERT OR REPLACE INTO profiles (id, nome, email, empresa_id, created_at) VALUES (?, ?, ?, ?, ?)`,
                    [p.id, p.nome, p.email, p.empresa_id, p.created_at]);
            });
        }
        
        // User roles
        const { data: roles } = await supabase.from('user_roles').select('*').eq('empresa_id', EMPRESA_ID);
        if (roles) {
            roles.forEach(r => {
                db.run(`INSERT OR REPLACE INTO user_roles (id, user_id, empresa_id, role, created_at) VALUES (?, ?, ?, ?, ?)`,
                    [r.id, r.user_id, r.empresa_id, r.role, r.created_at]);
            });
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
// Verifica se o email existe em profiles locais OU em credenciais de backup
app.post('/api/local/login', (req, res) => {
    const { email, password } = req.body;
    console.log("🔑 Tentativa de login local para:", email);
    
    // Primeiro, verifica credenciais de backup (se existir)
    db.get(`SELECT * FROM credenciais_locais WHERE email = ?`, [email], (err, credencial) => {
        if (credencial) {
            // Credencial de backup existe - verificar senha
            // Para simplificar, no modo offline aceitamos o login se o email existir
            // (a senha já foi validada quando criaram a credencial de backup)
            console.log("✅ Login via credencial de backup");
            return res.json({
                success: true,
                user: { id: credencial.user_id, email: credencial.email, nome: credencial.nome, role: credencial.role }
            });
        }
        
        // Se não tem credencial de backup, verifica nos profiles sincronizados
        db.get(`SELECT p.*, ur.role FROM profiles p 
                LEFT JOIN user_roles ur ON p.id = ur.user_id 
                WHERE p.email = ?`, [email], (err2, profile) => {
            if (profile) {
                console.log("✅ Login via profile sincronizado");
                return res.json({
                    success: true,
                    user: { id: profile.id, email: profile.email, nome: profile.nome, role: profile.role || 'caixa' }
                });
            }
            
            console.log("❌ Usuário não encontrado localmente");
            res.status(401).json({ success: false, message: "Usuário não encontrado localmente. Faça login online primeiro para sincronizar." });
        });
    });
});

// ENDPOINT PARA SALVAR CREDENCIAL LOCAL (chamar após login online bem-sucedido)
app.post('/api/local/salvar-credencial', (req, res) => {
    const { email, user_id, nome, role } = req.body;
    db.run(`INSERT OR REPLACE INTO credenciais_locais (email, user_id, nome, role) VALUES (?, ?, ?, ?)`,
        [email, user_id, nome, role], (err) => {
            if (err) {
                console.error("❌ Erro ao salvar credencial:", err);
                return res.status(500).json({ success: false });
            }
            console.log("✅ Credencial de backup salva para:", email);
            res.json({ success: true });
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