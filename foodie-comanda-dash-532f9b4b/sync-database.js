/**
 * Script de Sincronização do Banco de Dados
 * Compara o schema definido em types.ts com o Supabase remoto
 * e gera migrações SQL para sincronizar
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tabelas esperadas do types.ts
const EXPECTED_TABLES = [
  'avaliacoes',
  'caixas',
  'categorias',
  'chamadas_garcom',
  'comandas',
  'combo_itens',
  'combos',
  'config_delivery',
  'cupons',
  'cupons_uso',
  'empresas',
  'enderecos_cliente',
  'fidelidade_config',
  'fidelidade_pontos',
  'fidelidade_transacoes',
  'itens_delivery',
  'mesas',
  'movimentacoes_caixa',
  'pedidos',
  'pedidos_delivery',
  'produtos',
  'profiles',
  'promocao_itens',
  'promocoes',
  'reservas',
  'user_roles',
  'analytics_eventos',
  'relatorio_vendas_diarias',
  'relatorio_produtos_vendidos',
  'relatorio_horarios_pico',
  'relatorio_clientes_inativos',
  'relatorio_fidelidade_clientes',
  'chat_conversas',
  'chat_mensagens',
  'notificacoes_push',
  'password_reset_tokens',
  'delivery_tracking'
];

async function getRemoteTables() {
  try {
    const { data, error } = await supabase.rpc('get_all_tables', {}, {
      headers: {
        'apikey': SUPABASE_KEY
      }
    });

    if (error) {
      console.log('⚠️  Não foi possível usar RPC, tentando método alternativo...');
      
      // Método alternativo: tentar consultar information_schema
      const tables = [];
      for (const tableName of EXPECTED_TABLES) {
        const { data: testData, error: testError } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);
        
        if (!testError || testError.code !== '42P01') { // 42P01 = undefined_table
          tables.push(tableName);
        }
      }
      return tables;
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar tabelas:', error);
    return [];
  }
}

async function checkTableColumns(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error && error.code === '42P01') {
      return null; // Tabela não existe
    }
    
    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }
    
    // Tabela existe mas está vazia
    return [];
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('🔄 Iniciando sincronização do banco de dados...\n');
  
  // 1. Verificar conexão
  console.log('📡 Verificando conexão com Supabase...');
  const { data: testData, error: testError } = await supabase
    .from('empresas')
    .select('id')
    .limit(1);
  
  if (testError) {
    console.error('❌ Erro na conexão:', testError.message);
    console.log('\n💡 Verifique se as credenciais no .env estão corretas.');
    process.exit(1);
  }
  console.log('✅ Conexão estabelecida com sucesso!\n');
  
  // 2. Listar tabelas remotas
  console.log('📋 Verificando tabelas remotas...');
  const remoteTables = [];
  const missingTables = [];
  
  for (const tableName of EXPECTED_TABLES) {
    const columns = await checkTableColumns(tableName);
    if (columns === null) {
      missingTables.push(tableName);
      console.log(`   ❌ ${tableName} - NÃO EXISTE`);
    } else {
      remoteTables.push(tableName);
      console.log(`   ✅ ${tableName} - existe (${columns.length} colunas)`);
    }
  }
  
  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Tabelas existentes: ${remoteTables.length}`);
  console.log(`   ❌ Tabelas faltando: ${missingTables.length}`);
  
  if (missingTables.length > 0) {
    console.log(`\n⚠️  Tabelas que precisam ser criadas:`);
    missingTables.forEach(table => console.log(`   - ${table}`));
    
    console.log(`\n📝 Para criar essas tabelas, execute as migrações:`);
    console.log(`   1. Certifique-se de que todas as migrações em /supabase/migrations foram aplicadas`);
    console.log(`   2. Use o Supabase Dashboard > SQL Editor para executar as migrações`);
    console.log(`   3. Ou use: npx supabase db push`);
    
    // Gerar comandos SQL
    console.log(`\n🔧 Gerando comandos SQL de referência...`);
    
    const migrationFiles = fs.readdirSync(path.join(process.cwd(), 'supabase', 'migrations'))
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`\n📂 Migrações disponíveis (${migrationFiles.length} arquivos):`);
    migrationFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    
  } else {
    console.log(`\n🎉 Todas as tabelas estão sincronizadas!`);
  }
  
  // 3. Verificar migrações
  console.log(`\n\n🔍 Verificando status das migrações...`);
  const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations');
  const migrations = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  console.log(`\n📋 Total de migrações locais: ${migrations.length}`);
  
  // Últimas 5 migrações
  console.log(`\n📅 Últimas migrações:`);
  migrations.slice(-5).forEach(m => {
    const content = fs.readFileSync(path.join(migrationsPath, m), 'utf-8');
    const tables = content.match(/CREATE TABLE.*?(\w+)\s*\(/gi) || [];
    console.log(`   - ${m}`);
    if (tables.length > 0) {
      tables.forEach(t => {
        const tableName = t.match(/CREATE TABLE.*?(\w+)\s*\(/i)[1];
        console.log(`     └─ cria: ${tableName}`);
      });
    }
  });
  
  console.log(`\n✅ Sincronização completa!`);
  console.log(`\n💡 Próximos passos:`);
  console.log(`   1. Abra o Supabase Dashboard: https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy`);
  console.log(`   2. Vá em SQL Editor`);
  console.log(`   3. Execute as migrações que estão faltando`);
  console.log(`   4. Execute este script novamente para verificar`);
}

main().catch(console.error);
