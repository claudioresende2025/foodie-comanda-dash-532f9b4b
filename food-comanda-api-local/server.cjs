const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO REAL ---
const SUPABASE_URL = "https://zlwpxflqtyhdwanmupgy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw";

const db = new sqlite3.Database('./banco-local.sqlite');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Reinicie o servidor no terminal com: node server.js

// Cria as tabelas locais se não existirem
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    mesa_id TEXT,
    item TEXT,
    status TEXT,
    sincronizado INTEGER DEFAULT 0
  )`);
});

// ---------------------------------------------------------
// ROTAS LOCAIS (O GARÇOM CHAMA AQUI PELO WI-FI)
// ---------------------------------------------------------

// Garçom lança um pedido novo
app.post('/api/pedidos', (req, res) => {
    const { id, mesa_id, item } = req.body;

    // Salva no HD do computador do caixa IMEDIATAMENTE
    db.run(`INSERT INTO pedidos (id, mesa_id, item, status) VALUES (?, ?, ?, 'preparando')`,
        [id, mesa_id, item],
        function (err) {
            if (err) return res.status(500).json({ erro: err.message });

            // Responde pro celular do garçom na hora: "Sucesso!" (Sem usar internet)
            res.json({ sucesso: true, mensagem: 'Pedido salvo na cozinha e no caixa!' });
        });
});

// ---------------------------------------------------------
// O ROBÔ DE SINCRONIZAÇÃO (RODA EM SEGUNDO PLANO)
// ---------------------------------------------------------
setInterval(() => {
    console.log("Checando internet e sincronizando com Supabase...");

    // Busca todos os pedidos locais que ainda não subiram pra nuvem
    db.all(`SELECT * FROM pedidos WHERE sincronizado = 0`, async (err, rows) => {
        if (rows.length > 0) {
            // Tenta mandar pro Supabase
            const { data, error } = await supabase.from('pedidos').insert(rows);

            if (!error) {
                // Se deu certo, marca no banco local como "sincronizado"
                console.log(`${rows.length} pedidos enviados para a nuvem!`);
                db.run(`UPDATE pedidos SET sincronizado = 1 WHERE sincronizado = 0`);
            } else {
                console.log("Sem internet ou erro na nuvem. Tentarei novamente depois.");
            }
        }
    });
}, 10000); // Roda a cada 10 segundos

// Liga o servidor na porta 3000
app.listen(3000, '0.0.0.0', () => {
    console.log('🚀 Servidor Local do Caixa rodando na porta 3000');
});