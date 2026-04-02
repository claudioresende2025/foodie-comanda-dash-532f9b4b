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
 *   - JSON local para persistência offline (sem necessidade de Visual Studio)
 *   - Sincronização automática com Supabase quando online
 *   - Download automático de dados ao iniciar
 *   - Retransmissão de eventos para todos os dispositivos
 * 
 * PORTAS:
 *   - HTTP/REST: 3001
 *   - WebSocket: 3001 (mesmo servidor)
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

// Intervalo de sincronização com Supabase (5 minutos)
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Caminho do banco de dados JSON
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

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// BANCO DE DADOS JSON LOCAL
// ============================================

// Estrutura inicial do banco de dados
const defaultData = {
  pedidos: [],
  comandas: [],
  mesas: [],
  produtos: [],
  categorias: [],
  config: {
    empresa_id: null,
    last_sync: null
  },
  sync_queue: []
};

// Carregar ou criar banco de dados
function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('⚠️ Erro ao carregar banco de dados, criando novo:', err.message);
  }
  return { ...defaultData };
}

// Salvar banco de dados
function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Erro ao salvar banco de dados:', err.message);
  }
}

// Banco de dados em memória
let db = loadDatabase();

// Auto-save a cada 5 segundos
setInterval(() => {
  saveDatabase();
}, 5000);

function initDatabase() {
  console.log('📦 Inicializando banco de dados JSON...');
  
  // Garantir estrutura mínima
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
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
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

function addToSyncQueue(tabela, operacao, registroId, dados) {
  db.sync_queue.push({
    id: generateId(),
    tabela,
    operacao,
    registro_id: registroId,
    dados,
    criado_em: new Date().toISOString(),
    enviado: false
  });
  saveDatabase();
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
    console.log('⚠️ empresa_id não configurado, pulando download');
    return;
  }
  
  console.log('📥 Baixando dados do Supabase...');
  
  try {
    // Baixar produtos
    const { data: produtos, error: errProdutos } = await supabase
      .from('produtos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true);
    
    if (!errProdutos && produtos) {
      db.produtos = produtos.map(p => ({
        ...p,
        atualizado_em: new Date().toISOString()
      }));
      console.log(`  ✅ ${produtos.length} produtos baixados`);
    }
    
    // Baixar categorias
    const { data: categorias, error: errCategorias } = await supabase
      .from('categorias')
      .select('*')
      .eq('empresa_id', empresaId);
    
    if (!errCategorias && categorias) {
      db.categorias = categorias;
      console.log(`  ✅ ${categorias.length} categorias baixadas`);
    }
    
    // Baixar mesas
    const { data: mesas, error: errMesas } = await supabase
      .from('mesas')
      .select('*')
      .eq('empresa_id', empresaId);
    
    if (!errMesas && mesas) {
      db.mesas = mesas.map(m => ({
        ...m,
        sincronizado: true,
        atualizado_em: new Date().toISOString()
      }));
      console.log(`  ✅ ${mesas.length} mesas baixadas`);
    }
    
    db.config.last_sync = new Date().toISOString();
    saveDatabase();
    
    console.log('✅ Download do Supabase concluído');
    
    // Notificar clientes conectados
    io.emit('sync:download_complete', { timestamp: Date.now() });
    
  } catch (err) {
    console.error('❌ Erro ao baixar do Supabase:', err.message);
  }
}

async function uploadToSupabase() {
  if (syncInProgress) return;
  syncInProgress = true;
  
  console.log('📤 Sincronizando dados pendentes com Supabase...');
  
  try {
    // Buscar pedidos não sincronizados
    const pedidosPendentes = db.pedidos.filter(p => !p.sincronizado);
    
    if (pedidosPendentes.length > 0) {
      console.log(`  📦 ${pedidosPendentes.length} pedidos pendentes`);
      
      for (const pedido of pedidosPendentes) {
        const { error } = await supabase
          .from('pedidos')
          .upsert({
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
        } else {
          console.error(`  ❌ Erro ao sincronizar pedido ${pedido.id}:`, error.message);
        }
      }
    }
    
    // Buscar comandas não sincronizadas
    const comandasPendentes = db.comandas.filter(c => !c.sincronizado);
    
    if (comandasPendentes.length > 0) {
      console.log(`  📋 ${comandasPendentes.length} comandas pendentes`);
      
      for (const comanda of comandasPendentes) {
        const { error } = await supabase
          .from('comandas')
          .upsert({
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
        } else {
          console.error(`  ❌ Erro ao sincronizar comanda ${comanda.id}:`, error.message);
        }
      }
    }
    
    // Buscar mesas não sincronizadas
    const mesasPendentes = db.mesas.filter(m => !m.sincronizado);
    
    if (mesasPendentes.length > 0) {
      console.log(`  🪑 ${mesasPendentes.length} mesas pendentes`);
      
      for (const mesa of mesasPendentes) {
        const { error } = await supabase
          .from('mesas')
          .update({ status: mesa.status })
          .eq('id', mesa.id);
        
        if (!error) {
          const idx = db.mesas.findIndex(m => m.id === mesa.id);
          if (idx !== -1) db.mesas[idx].sincronizado = true;
        }
      }
    }
    
    saveDatabase();
    
    const totalPendentes = pedidosPendentes.length + comandasPendentes.length + mesasPendentes.length;
    if (totalPendentes > 0) {
      console.log(`✅ Sincronização concluída: ${totalPendentes} registros enviados`);
      io.emit('sync:upload_complete', { count: totalPendentes, timestamp: Date.now() });
    }
    
  } catch (err) {
    console.error('❌ Erro na sincronização:', err.message);
  } finally {
    syncInProgress = false;
  }
}

async function startSyncMonitor() {
  console.log('🔄 Iniciando monitor de sincronização...');
  
  // Carregar empresa_id do banco
  empresaId = db.config.empresa_id;
  
  // Verificar conexão periodicamente
  setInterval(async () => {
    const wasOnline = isOnline;
    isOnline = await checkInternetConnection();
    
    if (!wasOnline && isOnline) {
      console.log('🌐 Conexão restaurada! Iniciando sincronização...');
      io.emit('connection:restored');
      await uploadToSupabase();
      await downloadFromSupabase();
    } else if (wasOnline && !isOnline) {
      console.log('📴 Conexão perdida. Operando em modo offline.');
      io.emit('connection:lost');
    }
  }, 10000); // Verificar a cada 10 segundos
  
  // Sincronizar periodicamente quando online
  setInterval(async () => {
    if (isOnline) {
      await uploadToSupabase();
    }
  }, SYNC_INTERVAL_MS);
}

// ============================================
// ROTAS REST API
// ============================================

// Status do servidor
app.get('/api/status', (req, res) => {
  const pendingSync = {
    pedidos: db.pedidos.filter(p => !p.sincronizado).length,
    comandas: db.comandas.filter(c => !c.sincronizado).length,
    mesas: db.mesas.filter(m => !m.sincronizado).length
  };
  
  res.json({
    status: 'running',
    version: '1.1.0',
    ip: getLocalIP(),
    port: PORT,
    online: isOnline,
    empresa_id: empresaId || db.config.empresa_id,
    pending_sync: pendingSync,
    connected_clients: io.engine.clientsCount,
    uptime: process.uptime(),
    data_counts: {
      pedidos: db.pedidos.length,
      comandas: db.comandas.length,
      mesas: db.mesas.length,
      produtos: db.produtos.length
    }
  });
});

// Configurar empresa_id
app.post('/api/config/empresa', async (req, res) => {
  const { empresa_id } = req.body;
  if (!empresa_id) {
    return res.status(400).json({ error: 'empresa_id é obrigatório' });
  }
  
  empresaId = empresa_id;
  db.config.empresa_id = empresa_id;
  saveDatabase();
  
  console.log(`🏢 Empresa configurada: ${empresa_id}`);
  
  // Baixar dados da empresa
  if (isOnline) {
    await downloadFromSupabase();
  }
  
  res.json({ success: true, empresa_id });
});

// Forçar sincronização
app.post('/api/sync', async (req, res) => {
  if (!isOnline) {
    return res.status(503).json({ error: 'Servidor offline' });
  }
  
  await uploadToSupabase();
  await downloadFromSupabase();
  
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// ============================================
// ROTAS DE PEDIDOS
// ============================================

app.get('/api/pedidos', (req, res) => {
  const { comanda_id, status } = req.query;
  let pedidos = [...db.pedidos];
  
  if (comanda_id) {
    pedidos = pedidos.filter(p => p.comanda_id === comanda_id);
  }
  if (status) {
    pedidos = pedidos.filter(p => p.status_cozinha === status);
  }
  
  pedidos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  res.json(pedidos);
});

app.post('/api/pedidos', (req, res) => {
  const { comanda_id, produto_id, quantidade, observacoes, empresa_id: reqEmpresaId } = req.body;
  const id = generateId();
  const now = new Date().toISOString();
  
  const pedido = {
    id,
    comanda_id,
    produto_id,
    quantidade: quantidade || 1,
    observacoes: observacoes || '',
    status_cozinha: 'pendente',
    empresa_id: reqEmpresaId || empresaId || db.config.empresa_id,
    criado_em: now,
    atualizado_em: now,
    sincronizado: false
  };
  
  db.pedidos.push(pedido);
  saveDatabase();
  
  // Emitir evento para todos os clientes
  io.emit('pedido:novo', pedido);
  
  // Se online, tentar sincronizar imediatamente
  if (isOnline) {
    uploadToSupabase().catch(console.error);
  }
  
  res.status(201).json(pedido);
});

app.put('/api/pedidos/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const idx = db.pedidos.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  
  db.pedidos[idx] = {
    ...db.pedidos[idx],
    ...updates,
    atualizado_em: new Date().toISOString(),
    sincronizado: false
  };
  
  saveDatabase();
  
  // Emitir evento
  io.emit('pedido:atualizado', db.pedidos[idx]);
  
  res.json(db.pedidos[idx]);
});

app.put('/api/pedidos/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const idx = db.pedidos.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  
  db.pedidos[idx].status_cozinha = status;
  db.pedidos[idx].atualizado_em = new Date().toISOString();
  db.pedidos[idx].sincronizado = false;
  
  saveDatabase();
  
  // Emitir evento
  io.emit('pedido:status', { id, status, pedido: db.pedidos[idx] });
  
  res.json(db.pedidos[idx]);
});

// ============================================
// ROTAS DE COMANDAS
// ============================================

app.get('/api/comandas', (req, res) => {
  const { mesa_id, status } = req.query;
  let comandas = [...db.comandas];
  
  if (mesa_id) {
    comandas = comandas.filter(c => c.mesa_id === mesa_id);
  }
  if (status) {
    comandas = comandas.filter(c => c.status === status);
  }
  
  comandas.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  res.json(comandas);
});

app.post('/api/comandas', (req, res) => {
  const { mesa_id, empresa_id: reqEmpresaId } = req.body;
  const id = generateId();
  const now = new Date().toISOString();
  
  const comanda = {
    id,
    mesa_id,
    empresa_id: reqEmpresaId || empresaId || db.config.empresa_id,
    status: 'aberta',
    total: 0,
    criado_em: now,
    atualizado_em: now,
    sincronizado: false
  };
  
  db.comandas.push(comanda);
  saveDatabase();
  
  // Emitir evento
  io.emit('comanda:nova', comanda);
  
  res.status(201).json(comanda);
});

app.put('/api/comandas/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const idx = db.comandas.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Comanda não encontrada' });
  }
  
  db.comandas[idx] = {
    ...db.comandas[idx],
    ...updates,
    atualizado_em: new Date().toISOString(),
    sincronizado: false
  };
  
  saveDatabase();
  
  // Emitir evento
  io.emit('comanda:atualizada', db.comandas[idx]);
  
  res.json(db.comandas[idx]);
});

app.post('/api/comandas/:id/fechar', (req, res) => {
  const { id } = req.params;
  
  const idx = db.comandas.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Comanda não encontrada' });
  }
  
  db.comandas[idx].status = 'fechada';
  db.comandas[idx].atualizado_em = new Date().toISOString();
  db.comandas[idx].sincronizado = false;
  
  saveDatabase();
  
  // Emitir evento
  io.emit('comanda:fechada', db.comandas[idx]);
  
  res.json(db.comandas[idx]);
});

// ============================================
// ROTAS DE MESAS
// ============================================

app.get('/api/mesas', (req, res) => {
  const mesas = [...db.mesas].sort((a, b) => (a.numero || 0) - (b.numero || 0));
  res.json(mesas);
});

app.put('/api/mesas/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const idx = db.mesas.findIndex(m => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Mesa não encontrada' });
  }
  
  db.mesas[idx].status = status;
  db.mesas[idx].atualizado_em = new Date().toISOString();
  db.mesas[idx].sincronizado = false;
  
  saveDatabase();
  
  // Emitir evento
  io.emit('mesa:status', { id, status, mesa: db.mesas[idx] });
  
  res.json(db.mesas[idx]);
});

// ============================================
// ROTAS DE PRODUTOS
// ============================================

app.get('/api/produtos', (req, res) => {
  const { categoria_id, ativo } = req.query;
  let produtos = [...db.produtos];
  
  if (categoria_id) {
    produtos = produtos.filter(p => p.categoria_id === categoria_id);
  }
  if (ativo !== undefined) {
    produtos = produtos.filter(p => p.ativo === (ativo === 'true'));
  }
  
  res.json(produtos);
});

app.get('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  const produto = db.produtos.find(p => p.id === id);
  
  if (!produto) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }
  
  res.json(produto);
});

// ============================================
// ROTAS DE CATEGORIAS
// ============================================

app.get('/api/categorias', (req, res) => {
  const categorias = [...db.categorias].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  res.json(categorias);
});

// ============================================
// WEBSOCKET HANDLERS
// ============================================

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id} (Total: ${io.engine.clientsCount})`);
  
  // Enviar status inicial
  socket.emit('hub:status', {
    online: isOnline,
    empresa_id: empresaId || db.config.empresa_id,
    ip: getLocalIP(),
    port: PORT
  });
  
  // Identificação do cliente
  socket.on('client:identify', (data) => {
    console.log(`📱 Cliente identificado: ${data.type || 'unknown'} - ${data.name || socket.id}`);
    socket.data = { ...socket.data, ...data };
  });
  
  // Chamada de garçom
  socket.on('garcom:chamar', (data) => {
    console.log(`🔔 Chamada de garçom - Mesa: ${data.mesa_numero || data.mesa_id}`);
    io.emit('garcom:chamada', {
      ...data,
      timestamp: Date.now()
    });
  });
  
  // Novo pedido via WebSocket
  socket.on('pedido:criar', (data) => {
    const id = generateId();
    const now = new Date().toISOString();
    
    const pedido = {
      id,
      ...data,
      status_cozinha: 'pendente',
      criado_em: now,
      atualizado_em: now,
      sincronizado: false
    };
    
    db.pedidos.push(pedido);
    saveDatabase();
    
    // Broadcast para todos
    io.emit('pedido:novo', pedido);
    
    // Confirmar para o remetente
    socket.emit('pedido:criado', { success: true, pedido });
  });
  
  // Atualizar status do pedido
  socket.on('pedido:status', (data) => {
    const { id, status } = data;
    const idx = db.pedidos.findIndex(p => p.id === id);
    
    if (idx !== -1) {
      db.pedidos[idx].status_cozinha = status;
      db.pedidos[idx].atualizado_em = new Date().toISOString();
      db.pedidos[idx].sincronizado = false;
      saveDatabase();
      
      io.emit('pedido:status', { id, status, pedido: db.pedidos[idx] });
    }
  });
  
  // Status da mesa
  socket.on('mesa:status', (data) => {
    const { id, status } = data;
    const idx = db.mesas.findIndex(m => m.id === id);
    
    if (idx !== -1) {
      db.mesas[idx].status = status;
      db.mesas[idx].atualizado_em = new Date().toISOString();
      db.mesas[idx].sincronizado = false;
      saveDatabase();
      
      io.emit('mesa:status', { id, status, mesa: db.mesas[idx] });
    }
  });
  
  // Buscar dados
  socket.on('data:request', (data) => {
    const { type } = data;
    
    switch (type) {
      case 'produtos':
        socket.emit('data:produtos', db.produtos);
        break;
      case 'categorias':
        socket.emit('data:categorias', db.categorias);
        break;
      case 'mesas':
        socket.emit('data:mesas', db.mesas);
        break;
      case 'pedidos':
        socket.emit('data:pedidos', db.pedidos);
        break;
      case 'comandas':
        socket.emit('data:comandas', db.comandas);
        break;
    }
  });
  
  // Forçar sincronização
  socket.on('sync:force', async () => {
    if (isOnline) {
      await uploadToSupabase();
      await downloadFromSupabase();
      socket.emit('sync:complete', { success: true });
    } else {
      socket.emit('sync:complete', { success: false, error: 'Offline' });
    }
  });
  
  // Desconexão
  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id} (Total: ${io.engine.clientsCount})`);
  });
});

// ============================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================

async function startServer() {
  // Inicializar banco de dados
  initDatabase();
  
  // Verificar conexão inicial
  isOnline = await checkInternetConnection();
  console.log(`🌐 Status de conexão: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  
  // Baixar dados se online e empresa configurada
  if (isOnline && db.config.empresa_id) {
    empresaId = db.config.empresa_id;
    await downloadFromSupabase();
  }
  
  // Iniciar monitor de sincronização
  startSyncMonitor();
  
  // Iniciar servidor HTTP
  httpServer.listen(PORT, () => {
    const localIP = getLocalIP();
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║             FOOD COMANDA PRO - LOCAL HUB                   ║');
    console.log('║                   Servidor Local                           ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Porta:    ${PORT}                                            ║`);
    console.log(`║  IP Local: ${localIP.padEnd(45)}║`);
    console.log(`║  Status:   ${isOnline ? 'ONLINE 🌐' : 'OFFLINE 📴'}                                      ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Endpoints:                                                ║');
    console.log(`║  • http://${localIP}:${PORT}/api/status                     ║`);
    console.log(`║  • http://${localIP}:${PORT}/api/pedidos                    ║`);
    console.log(`║  • http://${localIP}:${PORT}/api/mesas                      ║`);
    console.log(`║  • WebSocket: ws://${localIP}:${PORT}                       ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 Aguardando conexões...');
    console.log('');
  });
}

// Capturar erros não tratados
process.on('uncaughtException', (err) => {
  console.error('❌ Erro não tratado:', err);
  saveDatabase(); // Salvar antes de possível crash
});

process.on('SIGINT', () => {
  console.log('\n👋 Encerrando servidor...');
  saveDatabase();
  process.exit(0);
});

// Iniciar
startServer().catch(console.error);
