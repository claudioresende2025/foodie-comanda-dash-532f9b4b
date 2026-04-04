#!/usr/bin/env node
/**
 * Script Avançado de Sincronização
 * Verifica estrutura completa das tabelas incluindo colunas
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Schema esperado de cada tabela
const TABLE_SCHEMAS = {
  empresas: ['id', 'nome_fantasia', 'cnpj', 'endereco_completo', 'logo_url', 'created_at', 'updated_at', 'chave_pix', 'inscricao_estadual', 'usuario_proprietario_id'],
  categorias: ['id', 'empresa_id', 'nome', 'descricao', 'ordem', 'ativo', 'created_at', 'updated_at'],
  produtos: ['id', 'empresa_id', 'categoria_id', 'nome', 'descricao', 'preco', 'imagem_url', 'ativo', 'created_at', 'updated_at'],
  mesas: ['id', 'empresa_id', 'numero_mesa', 'capacidade', 'status', 'mesa_juncao_id', 'created_at', 'updated_at'],
  comandas: ['id', 'empresa_id', 'mesa_id', 'nome_cliente', 'telefone_cliente', 'total', 'status', 'forma_pagamento', 'data_fechamento', 'qr_code_sessao', 'comanda_mestre_id', 'troco_para', 'created_at', 'updated_at'],
  pedidos: ['id', 'comanda_id', 'produto_id', 'quantidade', 'preco_unitario', 'subtotal', 'notas_cliente', 'status_cozinha', 'created_at', 'updated_at'],
  config_delivery: ['id', 'empresa_id', 'taxa_entrega', 'tempo_estimado_min', 'tempo_estimado_max', 'raio_entrega_km', 'valor_minimo_pedido', 'ativo', 'horario_abertura', 'horario_fechamento', 'dias_funcionamento', 'created_at', 'updated_at'],
  enderecos_cliente: ['id', 'user_id', 'nome_cliente', 'telefone', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep', 'referencia', 'is_default', 'created_at'],
  pedidos_delivery: ['id', 'empresa_id', 'user_id', 'endereco_id', 'subtotal', 'taxa_entrega', 'desconto', 'total', 'status', 'forma_pagamento', 'notas', 'agendado_para', 'cupom_id', 'troco_para', 'stripe_payment_id', 'stripe_payment_status', 'created_at', 'updated_at'],
  itens_delivery: ['id', 'pedido_delivery_id', 'produto_id', 'nome_produto', 'quantidade', 'preco_unitario', 'subtotal', 'notas', 'created_at'],
  caixas: ['id', 'empresa_id', 'usuario_id', 'data_abertura', 'data_fechamento', 'valor_abertura', 'valor_fechamento', 'status', 'observacoes', 'created_at'],
  movimentacoes_caixa: ['id', 'caixa_id', 'tipo', 'valor', 'descricao', 'forma_pagamento', 'comanda_id', 'pedido_delivery_id', 'created_at'],
  chamadas_garcom: ['id', 'empresa_id', 'mesa_id', 'comanda_id', 'status', 'atendida_at', 'created_at'],
  reservas: ['id', 'empresa_id', 'mesa_id', 'nome_cliente', 'telefone_cliente', 'email_cliente', 'data_reserva', 'horario_reserva', 'numero_pessoas', 'status', 'observacoes', 'created_at', 'updated_at'],
  combos: ['id', 'empresa_id', 'nome', 'descricao', 'preco_combo', 'imagem_url', 'ativo', 'created_at', 'updated_at'],
  combo_itens: ['id', 'combo_id', 'produto_id', 'quantidade', 'created_at'],
  cupons: ['id', 'empresa_id', 'codigo', 'tipo', 'valor', 'valor_minimo_pedido', 'data_inicio', 'data_fim', 'uso_maximo', 'uso_atual', 'ativo', 'created_at', 'updated_at'],
  cupons_uso: ['id', 'cupom_id', 'pedido_delivery_id', 'user_id', 'valor_desconto', 'created_at'],
  promocoes: ['id', 'empresa_id', 'nome', 'descricao', 'preco_promocional', 'data_inicio', 'data_fim', 'dias_semana', 'ativo', 'imagem_url', 'created_at', 'updated_at'],
  promocao_itens: ['id', 'promocao_id', 'produto_id', 'quantidade', 'created_at'],
  fidelidade_config: ['id', 'empresa_id', 'pontos_por_real', 'reais_por_ponto', 'ativo', 'descricao', 'created_at', 'updated_at'],
  fidelidade_pontos: ['id', 'user_id', 'empresa_id', 'saldo_pontos', 'created_at', 'updated_at'],
  fidelidade_transacoes: ['id', 'user_id', 'empresa_id', 'tipo', 'pontos', 'pedido_delivery_id', 'created_at'],
  profiles: ['id', 'email', 'nome', 'avatar_url', 'empresa_id', 'created_at', 'updated_at'],
  user_roles: ['id', 'user_id', 'empresa_id', 'role', 'created_at'],
  avaliacoes: ['id', 'pedido_delivery_id', 'user_id', 'empresa_id', 'nota_pedido', 'nota_entrega', 'comentario', 'created_at'],
  chat_conversas: ['id', 'empresa_id', 'user_id', 'status', 'ultima_mensagem', 'created_at', 'updated_at'],
  chat_mensagens: ['id', 'conversa_id', 'user_id', 'mensagem', 'tipo', 'lida', 'created_at'],
  notificacoes_push: ['id', 'user_id', 'titulo', 'mensagem', 'tipo', 'data', 'lida', 'created_at'],
  password_reset_tokens: ['id', 'user_id', 'token', 'expires_at', 'created_at', 'used'],
  delivery_tracking: ['id', 'pedido_delivery_id', 'status', 'latitude', 'longitude', 'observacao', 'created_at'],
  analytics_eventos: ['id', 'empresa_id', 'tipo_evento', 'dados', 'created_at'],
  relatorio_vendas_diarias: ['id', 'empresa_id', 'data', 'total_vendas', 'total_pedidos', 'ticket_medio', 'created_at'],
  relatorio_produtos_vendidos: ['id', 'empresa_id', 'produto_id', 'nome_produto', 'quantidade_vendida', 'receita_total', 'periodo_inicio', 'periodo_fim', 'created_at'],
  relatorio_horarios_pico: ['id', 'empresa_id', 'dia_semana', 'hora', 'quantidade_pedidos', 'receita', 'created_at'],
  relatorio_clientes_inativos: ['id', 'empresa_id', 'user_id', 'ultima_compra', 'dias_inativo', 'total_gasto', 'created_at'],
  relatorio_fidelidade_clientes: ['id', 'empresa_id', 'user_id', 'total_pontos', 'pontos_gastos', 'total_pedidos', 'valor_total_gasto', 'created_at']
};

async function getTableColumns(tableName) {
  try {
    // Tenta buscar a estrutura usando uma query de sistema
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        return { exists: false, columns: [] };
      }
      console.error(`   Erro ao verificar ${tableName}:`, error.message);
      return { exists: false, columns: [] };
    }
    
    // Se tabela existe mas está vazia, precisamos usar outro método
    if (!data || data.length === 0) {
      // Tenta inserir e remover para descobrir as colunas
      // (isso não vai funcionar sem service role key, então usamos o schema)
      return { exists: true, columns: [], empty: true };
    }
    
    const columns = Object.keys(data[0]);
    return { exists: true, columns, empty: false };
  } catch (error) {
    console.error(`   Erro ao processar ${tableName}:`, error.message);
    return { exists: false, columns: [] };
  }
}

async function generateMigrationSQL() {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const migrationName = `${timestamp}_sync_from_lovable.sql`;
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
  
  let sql = `-- Migração de Sincronização Completa
-- Gerada em: ${new Date().toISOString()}
-- Este arquivo contém todas as tabelas do schema Lovable

-- =============================================================================
-- NOTA: Esta migração foi gerada automaticamente
-- Verifique se as tabelas já existem antes de executar
-- =============================================================================

`;

  // Ler todas as migrações existentes e consolidar
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const allMigrations = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  console.log('\n📝 Consolidando migrações existentes...');
  
  for (const migration of allMigrations) {
    const content = fs.readFileSync(path.join(migrationsDir, migration), 'utf-8');
    sql += `\n-- Fonte: ${migration}\n`;
    sql += content;
    sql += '\n';
  }
  
  fs.writeFileSync(migrationPath, sql);
  console.log(`\n✅ Migração consolidada criada: ${migrationName}`);
  
  return migrationPath;
}

async function main() {
  console.log('🚀 Verificação Avançada de Sincronização do Banco de Dados\n');
  console.log('=' .repeat(70));
  
  // Verificar conexão
  console.log('\n📡 Testando conexão...');
  const { error: connError } = await supabase.from('empresas').select('id').limit(1);
  
  if (connError && connError.code === '42P01') {
    console.log('⚠️  Tabela empresas não existe! Banco de dados precisa ser inicializado.');
  } else if (connError) {
    console.error('❌ Erro de conexão:', connError.message);
    process.exit(1);
  } else {
    console.log('✅ Conexão OK!\n');
  }
  
  // Verificar cada tabela
  console.log('📊 Verificando estrutura das tabelas:\n');
  
  const results = {
    completas: [],
    incompletas: [],
    faltando: [],
    vazias: []
  };
  
  for (const [tableName, expectedColumns] of Object.entries(TABLE_SCHEMAS)) {
    const { exists, columns, empty } = await getTableColumns(tableName);
    
    if (!exists) {
      results.faltando.push(tableName);
      console.log(`❌ ${tableName.padEnd(30)} - NÃO EXISTE`);
    } else if (empty) {
      results.vazias.push(tableName);
      console.log(`⚠️  ${tableName.padEnd(30)} - existe mas está vazia`);
    } else {
      const missing = expectedColumns.filter(col => !columns.includes(col));
      const extra = columns.filter(col => !expectedColumns.includes(col));
      
      if (missing.length === 0 && extra.length === 0) {
        results.completas.push(tableName);
        console.log(`✅ ${tableName.padEnd(30)} - OK (${columns.length} colunas)`);
      } else {
        results.incompletas.push({ tableName, missing, extra });
        console.log(`⚠️  ${tableName.padEnd(30)} - divergências encontradas`);
        if (missing.length > 0) {
          console.log(`    └─ Faltando: ${missing.join(', ')}`);
        }
        if (extra.length > 0) {
          console.log(`    └─ Extra: ${extra.join(', ')}`);
        }
      }
    }
  }
  
  // Resumo
  console.log('\n' + '='.repeat(70));
  console.log('\n📈 RESUMO DA SINCRONIZAÇÃO:\n');
  console.log(`   ✅ Tabelas completas:    ${results.completas.length}`);
  console.log(`   ⚠️  Tabelas vazias:       ${results.vazias.length}`);
  console.log(`   ⚠️  Tabelas incompletas:  ${results.incompletas.length}`);
  console.log(`   ❌ Tabelas faltando:     ${results.faltando.length}`);
  console.log(`   📊 Total:                ${Object.keys(TABLE_SCHEMAS).length}`);
  
  // Ações recomendadas
  if (results.faltando.length > 0 || results.incompletas.length > 0) {
    console.log('\n\n🔧 AÇÕES NECESSÁRIAS:\n');
    
    if (results.faltando.length > 0) {
      console.log('   1️⃣  Tabelas que precisam ser criadas:');
      results.faltando.forEach(t => console.log(`      - ${t}`));
    }
    
    if (results.incompletas.length > 0) {
      console.log('\n   2️⃣  Tabelas que precisam ser atualizadas:');
      results.incompletas.forEach(({ tableName, missing }) => {
        console.log(`      - ${tableName}`);
        if (missing.length > 0) {
          console.log(`        Adicionar colunas: ${missing.join(', ')}`);
        }
      });
    }
    
    console.log('\n\n📋 COMO APLICAR AS MIGRAÇÕES:\n');
    console.log('   Opção 1 - Supabase Dashboard (Recomendado):');
    console.log('   1. Acesse: https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/editor');
    console.log('   2. Vá em "SQL Editor"');
    console.log('   3. Clique em "+ New Query"');
    console.log('   4. Cole o conteúdo das migrações do diretório supabase/migrations/');
    console.log('   5. Execute cada migração na ordem');
    
    console.log('\n   Opção 2 - Via linha de comando:');
    console.log('   1. Instale o Supabase CLI: brew install supabase/tap/supabase');
    console.log('   2. Faça login: supabase login');
    console.log('   3. Link ao projeto: supabase link --project-ref zlwpxflqtyhdwanmupgy');
    console.log('   4. Aplique: supabase db push');
    
  } else {
    console.log('\n\n🎉 BANCO DE DADOS SINCRONIZADO!\n');
    console.log('   Todas as tabelas estão criadas e atualizadas.');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n💾 Salvando relatório...\n');
  
  const reportPath = path.join(process.cwd(), 'database-sync-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`✅ Relatório salvo em: database-sync-report.json`);
  
  console.log('\n✨ Verificação concluída!\n');
}

main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
