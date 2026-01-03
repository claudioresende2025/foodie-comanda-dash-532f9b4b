/**
 * Script para aplicar a migração de correção do delivery
 * Este script aplica a migração 20260102_fix_delivery_relationships.sql
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log('🚀 Aplicando migração de correção do delivery...\n');

  try {
    // Ler o arquivo de migração
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260102_fix_delivery_relationships.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migração carregada:', migrationPath);
    console.log('📝 Tamanho:', migrationSQL.length, 'bytes\n');

    // Dividir em statements individuais
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log('📋 Total de statements:', statements.length, '\n');

    // Executar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`⏳ Executando statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // Alguns erros são esperados (tabelas que já existem, etc)
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('duplicate')) {
          console.log(`⚠️  Aviso (ignorado): ${error.message}\n`);
        } else {
          console.error(`❌ Erro no statement ${i + 1}:`, error.message);
          console.error('Statement:', statement.substring(0, 100) + '...\n');
          // Continuar mesmo com erro
        }
      } else {
        console.log(`✅ Statement ${i + 1} executado com sucesso\n`);
      }
    }

    // Verificar se as tabelas existem agora
    console.log('\n🔍 Verificando estrutura do banco...\n');

    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedidos_delivery')
      .select('*')
      .limit(1);

    const { data: itens, error: itensError } = await supabase
      .from('itens_delivery')
      .select('*')
      .limit(1);

    if (!pedidosError) {
      console.log('✅ Tabela pedidos_delivery: OK');
    } else {
      console.log('❌ Tabela pedidos_delivery:', pedidosError.message);
    }

    if (!itensError) {
      console.log('✅ Tabela itens_delivery: OK');
    } else {
      console.log('❌ Tabela itens_delivery:', itensError.message);
    }

    // Testar o join
    console.log('\n🔗 Testando relacionamento...\n');
    const { data: joinTest, error: joinError } = await supabase
      .from('pedidos_delivery')
      .select(`
        id,
        total,
        itens_delivery!itens_delivery_pedido_delivery_id_fkey (
          id,
          nome_produto,
          quantidade
        )
      `)
      .limit(1);

    if (!joinError) {
      console.log('✅ Relacionamento entre pedidos_delivery e itens_delivery: OK');
      console.log('📊 Teste retornou:', joinTest?.length || 0, 'registros');
    } else {
      console.log('❌ Erro no relacionamento:', joinError.message);
    }

    console.log('\n✨ Migração concluída!\n');
    
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

applyMigration();
