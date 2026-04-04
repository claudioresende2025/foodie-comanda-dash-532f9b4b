/**
 * Script para sincronizar o schema do banco de dados
 * Força o Supabase a recarregar o cache do schema
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function refreshSchema() {
  console.log('🔄 Forçando atualização do cache do schema...\n');

  try {
    // Tentar fazer uma query que force o reload do schema
    const { data: tables, error } = await supabase
      .from('pedidos_delivery')
      .select('*, itens_delivery(*)')
      .limit(0);

    if (error) {
      console.log('⚠️  Erro esperado (forçando reload):', error.message);
    }

    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Tentar novamente com o hint de foreign key
    console.log('\n🔗 Testando relacionamento com hint explícito...\n');
    
    const { data: joinTest, error: joinError } = await supabase
      .from('pedidos_delivery')
      .select(`
        id,
        total,
        status,
        itens_delivery!itens_delivery_pedido_delivery_id_fkey (
          id,
          nome_produto,
          quantidade,
          preco_unitario
        )
      `)
      .limit(5);

    if (joinError) {
      console.log('❌ Erro no relacionamento:', joinError.message);
      console.log('\n📋 Possíveis soluções:');
      console.log('1. Acesse o Dashboard do Supabase: https://zlwpxflqtyhdwanmupgy.supabase.co');
      console.log('2. Vá em SQL Editor');
      console.log('3. Execute o SQL da migração: supabase/migrations/20260102_fix_delivery_relationships.sql');
      console.log('4. Aguarde 1-2 minutos para o cache atualizar');
      console.log('5. Execute este script novamente\n');
      
      // Verificar se as constraints existem
      console.log('🔍 Verificando constraints...\n');
      const { data: constraints, error: constError } = await supabase
        .rpc('get_foreign_keys', {}, { count: 'exact' });
      
      if (constError) {
        console.log('⚠️  Não foi possível verificar constraints automaticamente');
      }
    } else {
      console.log('✅ Relacionamento funcionando!');
      console.log('📊 Pedidos encontrados:', joinTest?.length || 0);
      if (joinTest && joinTest.length > 0) {
        console.log('\n📦 Exemplo de dados:');
        console.log(JSON.stringify(joinTest[0], null, 2));
      }
    }

    // Verificar estrutura básica
    console.log('\n🔍 Verificando estrutura básica...\n');
    
    const { count: pedidosCount } = await supabase
      .from('pedidos_delivery')
      .select('*', { count: 'exact', head: true });

    const { count: itensCount } = await supabase
      .from('itens_delivery')
      .select('*', { count: 'exact', head: true });

    console.log('📊 Total de pedidos_delivery:', pedidosCount || 0);
    console.log('📊 Total de itens_delivery:', itensCount || 0);

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

refreshSchema();
