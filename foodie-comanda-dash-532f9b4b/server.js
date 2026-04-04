/**
 * ============================================
 * FOOD COMANDA PRO - LOCAL HUB SERVER
 * ============================================
 * 
 * Servidor híbrido que roda no PC do Caixa e funciona como
 * gateway entre dispositivos na LAN e o Supabase na nuvem.
 * 
 * MODO DE USO:
 *   npm run hub
 * 
 * FUNCIONALIDADES:
 *   - WebSocket para comunicação em tempo real na LAN
 *   - JSON local para persistência offline
 *   - Sincronização automática com Supabase quando online
 *   - Download automático de dados ao iniciar
 *   - Retransmissão de eventos para todos os dispositivos
 * 
 * PORTAS:
 *   - HTTP/REST: 3001
 *   - WebSocket: 3001
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ============================================
// CONFIGURAÇÃO
// ============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.HUB_PORT || 3001;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tqmunlilydcowndqxiir.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxbXVubGlseWRjb3duZHF4aWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNjQ2MTIsImV4cCI6MjA2Mjc0MDYxMn0.I7loLmoEjurXzfKrntKvJOHjSH-JaAC4rbo90ThP5Zk';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const DATA_FILE = path.join(__dirname, 'hub_data.json');

// ============================================
// INICIALIZAÇÃO
// ============================================

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.use(cors());
app.use(express.json());

// ============================================
// BANCO DE DADOS JSON LOCAL
// ============================================

const defaultData = {
  pedidos: [],
  comandas: [],
  mesas: [],
  produtos: [],
  categorias: [],
  config: { empresa_id: null, last_sync: null },
  sync_queue: []
};

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('⚠️ Erro ao carregar banco:', err.message);
  }
  return { ...defaultData };
}

function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Erro ao salvar banco:', err.message);
  }
}

let db = loadDatabase();

setInterval(() => saveDatabase(), 5000);

function initDatabase() {
  console.log('📦 Inicializando banco de dados...');
  if (!db.pedidos) db.pedidos = [];
  if (!db.comandas) db.comandas = [];
  if (!db.mesas) db.mesas = [];
  if (!db.produtos) db.produtos = [];
  if (!db.categorias) db.categorias = [];
  if (!db.config) db.config = { empresa_id: null, last_sync: null };
  if (!db.sync_queue) db.sync_queue = [];
  saveDatabase();
  console.log('✅ Banco de dados inicializado');
}

// ============================================
// UTILITÁRIOS
// ============================================

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  
  // Coletar todos os IPs IPv4 não-internos
  for (const [name, ifaces] of Object.entries(interfaces)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({
          name,
          address: iface.address,
          // Priorizar interfaces físicas sobre virtuais
          priority: getPriority(name, iface.address)
        });
      }
    }
  }
  
  // Ordenar por prioridade (maior primeiro)
  candidates.sort((a, b) => b.priority - a.priority);
  
  if (candidates.length > 0) {
    // Log de todas as interfaces encontradas
    console.log('📡 Interfaces de rede encontradas:');
    candidates.forEach(c => console.log(`   - ${c.name}: ${c.address} (prioridade: ${c.priority})`));
    return candidates[0].address;
  }
  
  return '127.0.0.1';
}

function getPriority(name, address) {
  const nameLower = name.toLowerCase();
  
  // IPs que começam com 192.168.2.x ou 192.168.1.x são mais prováveis de ser rede local real
  if (address.startsWith('192.168.2.') || address.startsWith('192.168.1.') || address.startsWith('192.168.0.')) {
    return 100;
  }
  
  // Interfaces físicas comuns
  if (nameLower.includes('ethernet') || nameLower.includes('wi-fi') || nameLower.includes('wifi')) {
    return 80;
  }
  
  // Evitar interfaces virtuais (VPN, Docker, etc)
  if (nameLower.includes('virtualbox') || nameLower.includes('vmware') || 
      nameLower.includes('docker') || nameLower.includes('vethernet') ||
      nameLower.includes('loopback') || nameLower.includes('vpn') ||
      nameLower.includes('tailscale') || nameLower.includes('zerotier')) {
    return 10;
  }
  
  // IPs em ranges menos comuns para rede doméstica
  if (address.startsWith('192.168.192.') || address.startsWith('172.') || address.startsWith('10.')) {
    return 20;
  }
  
  return 50; // Prioridade média para desconhecidos
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function checkInternetConnection() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}

// ============================================
// SINCRONIZAÇÃO COM SUPABASE
// ============================================

let isOnline = true;
let syncInProgress = false;
let empresaId = null;

async function downloadFromSupabase() {
  empresaId = db.config.empresa_id;
  if (!empresaId) {
    console.log('⚠️ empresa_id não configurado');
    return;
  }
  
  console.log('📥 Baixando dados do Supabase...');
  
  try {
    const { data: produtos } = await supabase
      .from('produtos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true);
    
    if (produtos) {
      db.produtos = produtos;
      console.log(`  ✅ ${produtos.length} produtos`);
    }
    
    const { data: categorias } = await supabase
      .from('categorias')
      .select('*')
      .eq('empresa_id', empresaId);
    
    if (categorias) {
      db.categorias = categorias;
      console.log(`  ✅ ${categorias.length} categorias`);
    }
    
    const { data: mesas } = await supabase
      .from('mesas')
      .select('*')
      .eq('empresa_id', empresaId);
    
    if (mesas) {
      db.mesas = mesas.map(m => ({ ...m, sincronizado: true }));
      console.log(`  ✅ ${mesas.length} mesas`);
    }
    
    db.config.last_sync = new Date().toISOString();
    saveDatabase();
    console.log('✅ Download concluído');
    io.emit('sync:download_complete', { timestamp: Date.now() });
  } catch (err) {
    console.error('❌ Erro no download:', err.message);
  }
}

async function uploadToSupabase() {
  if (syncInProgress) return;
  syncInProgress = true;
  
  try {
    const pedidosPendentes = db.pedidos.filter(p => !p.sincronizado);
    for (const pedido of pedidosPendentes) {
      const { error } = await supabase.from('pedidos').upsert({
        id: pedido.id,
        comanda_id: pedido.comanda_id,
        produto_id: pedido.produto_id,
        quantidade: pedido.quantidade,
        observacoes: pedido.observacoes,
        status_cozinha: pedido.status_cozinha,
        criado_em: pedido.criado_em,
      }, { onConflict: 'id' });
      
      if (!error) {
        const idx = db.pedidos.findIndex(p => p.id === pedido.id);
        if (idx !== -1) db.pedidos[idx].sincronizado = true;
      }
    }
    
    const comandasPendentes = db.comandas.filter(c => !c.sincronizado);
    for (const comanda of comandasPendentes) {
      const { error } = await supabase.from('comandas').upsert({
        id: comanda.id,
        mesa_id: comanda.mesa_id,
        empresa_id: comanda.empresa_id,
        status: comanda.status,
        total: comanda.total,
        criado_em: comanda.criado_em,
      }, { onConflict: 'id' });
      
      if (!error) {
        const idx = db.comandas.findIndex(c => c.id === comanda.id);
        if (idx !== -1) db.comandas[idx].sincronizado = true;
      }
    }
    
    saveDatabase();
    
    const total = pedidosPendentes.length + comandasPendentes.length;
    if (total > 0) {
      console.log(`📤 ${total} registros sincronizados`);
      io.emit('sync:upload_complete', { count: total, timestamp: Date.now() });
    }
  } catch (err) {
    console.error('❌ Erro no upload:', err.message);
  } finally {
    syncInProgress = false;
  }
}

async function startSyncMonitor() {
  console.log('🔄 Monitor de sincronização iniciado');
  empresaId = db.config.empresa_id;
  
  setInterval(async () => {
    const wasOnline = isOnline;
    isOnline = await checkInternetConnection();
    
    if (!wasOnline && isOnline) {
      console.log('🌐 Conexão restaurada!');
      io.emit('connection:restored');
      await uploadToSupabase();
      await downloadFromSupabase();
    } else if (wasOnline && !isOnline) {
      console.log('📴 Modo offline');
      io.emit('connection:lost');
    }
  }, 10000);
  
  setInterval(async () => {
    if (isOnline) await uploadToSupabase();
  }, SYNC_INTERVAL_MS);
}

// ============================================
// ROTAS REST API
// ============================================

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '1.2.0',
    ip: getLocalIP(),
    port: PORT,
    online: isOnline,
    empresa_id: empresaId || db.config.empresa_id,
    pending_sync: {
      pedidos: db.pedidos.filter(p => !p.sincronizado).length,
      comandas: db.comandas.filter(c => !c.sincronizado).length,
      mesas: db.mesas.filter(m => !m.sincronizado).length
    },
    connected_clients: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

app.post('/api/config/empresa', async (req, res) => {
  const { empresa_id } = req.body;
  if (!empresa_id) return res.status(400).json({ error: 'empresa_id obrigatório' });
  
  empresaId = empresa_id;
  db.config.empresa_id = empresa_id;
  saveDatabase();
  console.log(`🏢 Empresa: ${empresa_id}`);
  
  if (isOnline) await downloadFromSupabase();
  res.json({ success: true, empresa_id });
});

app.post('/api/sync', async (req, res) => {
  if (!isOnline) return res.status(503).json({ error: 'Offline' });
  await uploadToSupabase();
  await downloadFromSupabase();
  res.json({ success: true });
});

// Pedidos
app.get('/api/pedidos', (req, res) => {
  let pedidos = [...db.pedidos];
  if (req.query.comanda_id) pedidos = pedidos.filter(p => p.comanda_id === req.query.comanda_id);
  if (req.query.status) pedidos = pedidos.filter(p => p.status_cozinha === req.query.status);
  res.json(pedidos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)));
});

app.post('/api/pedidos', (req, res) => {
  const { comanda_id, produto_id, quantidade, observacoes } = req.body;
  const pedido = {
    id: generateId(),
    comanda_id,
    produto_id,
    quantidade: quantidade || 1,
    observacoes: observacoes || '',
    status_cozinha: 'pendente',
    empresa_id: empresaId || db.config.empresa_id,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    sincronizado: false
  };
  
  db.pedidos.push(pedido);
  saveDatabase();
  io.emit('pedido:novo', pedido);
  if (isOnline) uploadToSupabase().catch(() => {});
  res.status(201).json(pedido);
});

app.put('/api/pedidos/:id/status', (req, res) => {
  const idx = db.pedidos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  
  db.pedidos[idx].status_cozinha = req.body.status;
  db.pedidos[idx].atualizado_em = new Date().toISOString();
  db.pedidos[idx].sincronizado = false;
  saveDatabase();
  
  io.emit('pedido:status', { id: req.params.id, status: req.body.status, pedido: db.pedidos[idx] });
  res.json(db.pedidos[idx]);
});

// Comandas
app.get('/api/comandas', (req, res) => {
  let comandas = [...db.comandas];
  if (req.query.mesa_id) comandas = comandas.filter(c => c.mesa_id === req.query.mesa_id);
  if (req.query.status) comandas = comandas.filter(c => c.status === req.query.status);
  res.json(comandas);
});

app.post('/api/comandas', (req, res) => {
  const comanda = {
    id: generateId(),
    mesa_id: req.body.mesa_id,
    empresa_id: empresaId || db.config.empresa_id,
    status: 'aberta',
    total: 0,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    sincronizado: false
  };
  
  db.comandas.push(comanda);
  saveDatabase();
  io.emit('comanda:nova', comanda);
  res.status(201).json(comanda);
});

app.post('/api/comandas/:id/fechar', (req, res) => {
  const idx = db.comandas.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrada' });
  
  db.comandas[idx].status = 'fechada';
  db.comandas[idx].atualizado_em = new Date().toISOString();
  db.comandas[idx].sincronizado = false;
  saveDatabase();
  
  io.emit('comanda:fechada', db.comandas[idx]);
  res.json(db.comandas[idx]);
});

// Mesas
app.get('/api/mesas', (req, res) => {
  res.json(db.mesas.sort((a, b) => (a.numero || 0) - (b.numero || 0)));
});

app.put('/api/mesas/:id/status', (req, res) => {
  const idx = db.mesas.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrada' });
  
  db.mesas[idx].status = req.body.status;
  db.mesas[idx].atualizado_em = new Date().toISOString();
  db.mesas[idx].sincronizado = false;
  saveDatabase();
  
  io.emit('mesa:status', { id: req.params.id, status: req.body.status, mesa: db.mesas[idx] });
  res.json(db.mesas[idx]);
});

// Produtos e Categorias
app.get('/api/produtos', (req, res) => res.json(db.produtos));
app.get('/api/categorias', (req, res) => res.json(db.categorias));

// ============================================
// WEBSOCKET HANDLERS
// ============================================

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id} (Total: ${io.engine.clientsCount})`);
  
  socket.emit('hub:status', {
    online: isOnline,
    empresa_id: empresaId || db.config.empresa_id,
    ip: getLocalIP(),
    port: PORT
  });
  
  socket.on('client:identify', (data) => {
    console.log(`📱 ${data.type || 'unknown'}: ${data.name || socket.id}`);
    socket.data = { ...socket.data, ...data };
  });
  
  socket.on('garcom:chamar', (data) => {
    console.log(`🔔 Chamada garçom - Mesa: ${data.mesa_numero || data.mesa_id}`);
    io.emit('garcom:chamada', { ...data, timestamp: Date.now() });
  });
  
  socket.on('pedido:criar', (data) => {
    const pedido = {
      id: generateId(),
      ...data,
      status_cozinha: 'pendente',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      sincronizado: false
    };
    db.pedidos.push(pedido);
    saveDatabase();
    io.emit('pedido:novo', pedido);
    socket.emit('pedido:criado', { success: true, pedido });
  });
  
  socket.on('pedido:status', (data) => {
    const idx = db.pedidos.findIndex(p => p.id === data.id);
    if (idx !== -1) {
      db.pedidos[idx].status_cozinha = data.status;
      db.pedidos[idx].atualizado_em = new Date().toISOString();
      db.pedidos[idx].sincronizado = false;
      saveDatabase();
      io.emit('pedido:status', { id: data.id, status: data.status, pedido: db.pedidos[idx] });
    }
  });
  
  socket.on('mesa:status', (data) => {
    const idx = db.mesas.findIndex(m => m.id === data.id);
    if (idx !== -1) {
      db.mesas[idx].status = data.status;
      db.mesas[idx].atualizado_em = new Date().toISOString();
      db.mesas[idx].sincronizado = false;
      saveDatabase();
      io.emit('mesa:status', { id: data.id, status: data.status, mesa: db.mesas[idx] });
    }
  });
  
  socket.on('data:request', (data) => {
    const map = {
      produtos: db.produtos,
      categorias: db.categorias,
      mesas: db.mesas,
      pedidos: db.pedidos,
      comandas: db.comandas
    };
    socket.emit(`data:${data.type}`, map[data.type] || []);
  });
  
  socket.on('sync:force', async () => {
    if (isOnline) {
      await uploadToSupabase();
      await downloadFromSupabase();
      socket.emit('sync:complete', { success: true });
    } else {
      socket.emit('sync:complete', { success: false, error: 'Offline' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Desconectado: ${socket.id} (Total: ${io.engine.clientsCount})`);
  });
});

// ============================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================

async function startServer() {
  initDatabase();
  
  isOnline = await checkInternetConnection();
  console.log(`🌐 Status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  
  if (isOnline && db.config.empresa_id) {
    empresaId = db.config.empresa_id;
    await downloadFromSupabase();
  }
  
  startSyncMonitor();
  
  httpServer.listen(PORT, () => {
    const localIP = getLocalIP();
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║             FOOD COMANDA PRO - LOCAL HUB                   ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Porta:    ${PORT}                                            ║`);
    console.log(`║  IP Local: ${localIP.padEnd(45)}║`);
    console.log(`║  Status:   ${isOnline ? 'ONLINE 🌐' : 'OFFLINE 📴'}                                      ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  • http://${localIP}:${PORT}/api/status                     ║`);
    console.log(`║  • WebSocket: ws://${localIP}:${PORT}                       ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 Aguardando conexões...');
    console.log('');
  });
}

process.on('uncaughtException', (err) => {
  console.error('❌ Erro:', err);
  saveDatabase();
});

process.on('SIGINT', () => {
  console.log('\n👋 Encerrando...');
  saveDatabase();
  process.exit(0);
});

startServer().catch(console.error);
