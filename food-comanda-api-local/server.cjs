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

// Cria a tabela local se não existir
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    mesa_id TEXT,
    item TEXT,
    status TEXT,
    sincronizado INTEGER DEFAULT 0
  )`);
});

// --- 📥 ROTA: RECEBER PEDIDO DO GARÇOM (WI-FI) ---
app.post('/api/pedidos', (req, res) => {
    const { id, mesa_id, item } = req.body;

    db.run(`INSERT INTO pedidos (id, mesa_id, item, status) VALUES (?, ?, ?, 'preparando')`,
        [id, mesa_id, item],
        function (err) {
            if (err) {
                console.error("❌ Erro ao salvar no SQLite:", err.message);
                return res.status(500).json({ erro: err.message });
            }
            console.log(`📦 Pedido recebido e salvo no caixa: ${item}`);
            res.json({ sucesso: true, mensagem: 'Pedido salvo na cozinha e no caixa!' });
        });
});

// --- 🤖 ROBÔ DE SINCRONIZAÇÃO (OFFLINE-FIRST) ---
setInterval(() => {
    console.log("🔍 Checando internet e sincronizando com Supabase...");

    db.all(`SELECT * FROM pedidos WHERE sincronizado = 0`, async (err, rows) => {
        if (err) return console.error(err.message);

        if (rows && rows.length > 0) {
            // TRADUÇÃO: De banco local simples para Postgres Relacional Profissional
            // Agora o robô pega o ID que veio do celular do garçom!
            const pedidosParaNuvem = rows.map(row => ({
                id: row.id,
                comanda_id: row.mesa_id, // <-- MUDANÇA AQUI: Agora usamos o ID real que veio do App
                produto_id: "34d42040-62bc-40ea-a8a9-ec432dbec140",
                empresa_id: "0b49e4e3-72d8-461d-b70a-f3f53b8ba80b",
                quantidade: 1,
                preco_unitario: 10,
                subtotal: 10,
                status_cozinha: 'pendente',
                notas_cliente: `Pedido Offline: ${row.item}`
            }));

            const { data, error } = await supabase.from('pedidos').insert(pedidosParaNuvem);

            if (!error) {
                console.log(`✅ SUCESSO: ${rows.length} pedidos enviados para a nuvem!`);
                db.run(`UPDATE pedidos SET sincronizado = 1 WHERE sincronizado = 0`);
            } else {
                console.log("❌ ERRO NO SUPABASE:", error.message);
            }
        }
    });
}, 10000); // Tenta sincronizar a cada 10 segundos

// --- 🚀 LIGAR O MOTOR ---
app.listen(3000, '0.0.0.0', () => {
    console.log('-------------------------------------------');
    console.log('🚀 FOOD COMANDA PRO - SERVIDOR LOCAL ATIVO');
    console.log('📍 Endereço do Caixa: http://192.168.2.111:3000');
    console.log('-------------------------------------------');
});