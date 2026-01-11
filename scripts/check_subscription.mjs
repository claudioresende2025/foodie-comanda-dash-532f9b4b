import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jejpufnzaineihemdrgd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplanB1Zm56YWluZWloZW1kcmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODgxMDAsImV4cCI6MjA4MDM2NDEwMH0.b0sXHLsReI8DOSN-IKz1PxSF9pQ3zjkkK1PKsCQkHMg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  console.log('🔍 Verificando assinaturas no banco de dados...\n');

  // 1. Listar todas as empresas
  const { data: empresas, error: empErr } = await supabase
    .from('empresas')
    .select('id, nome_fantasia')
    .limit(20);
  
  if (empErr) {
    console.error('Erro ao buscar empresas:', empErr);
    return;
  }

  console.log('📋 EMPRESAS CADASTRADAS:');
  console.log('=' .repeat(80));
  for (const emp of empresas || []) {
    console.log(`ID: ${emp.id}`);
    console.log(`Nome: ${emp.nome_fantasia}`);
    console.log('-'.repeat(40));
  }

  // 2. Listar todas as assinaturas
  const { data: assinaturas, error: assErr } = await supabase
    .from('assinaturas')
    .select('*, plano:planos(nome)')
    .limit(20);
  
  if (assErr) {
    console.error('Erro ao buscar assinaturas:', assErr);
    return;
  }

  console.log('\n📄 ASSINATURAS:');
  console.log('=' .repeat(80));
  if (!assinaturas || assinaturas.length === 0) {
    console.log('⚠️ NENHUMA ASSINATURA ENCONTRADA NO BANCO!');
  } else {
    for (const ass of assinaturas) {
      console.log(`Empresa ID: ${ass.empresa_id}`);
      console.log(`Plano: ${ass.plano?.nome || 'N/A'}`);
      console.log(`Status: ${ass.status}`);
      console.log(`Stripe Customer: ${ass.stripe_customer_id || 'N/A'}`);
      console.log(`Stripe Subscription: ${ass.stripe_subscription_id || 'N/A'}`);
      console.log(`Trial End: ${ass.trial_end || 'N/A'}`);
      console.log('-'.repeat(40));
    }
  }

  // 3. Listar profiles com empresa_id
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, nome, email, empresa_id')
    .limit(20);
  
  console.log('\n👤 TODOS OS PROFILES:');
  console.log('=' .repeat(80));
  for (const prof of profiles || []) {
    console.log(`User ID: ${prof.id}`);
    console.log(`Nome: ${prof.nome}`);
    console.log(`Email: ${prof.email}`);
    console.log(`Empresa ID: ${prof.empresa_id || 'SEM EMPRESA'}`);
    
    // Verificar se tem assinatura
    const hasAssinatura = assinaturas?.some(a => a.empresa_id === prof.empresa_id);
    console.log(`Tem Assinatura: ${hasAssinatura ? '✅ SIM' : '❌ NÃO'}`);
    console.log('-'.repeat(40));
  }

  // 4. Listar pagamentos
  const { data: pagamentos, error: pagErr } = await supabase
    .from('pagamentos_assinatura')
    .select('*')
    .limit(10);
  
  console.log('\n💳 PAGAMENTOS:');
  console.log('=' .repeat(80));
  if (!pagamentos || pagamentos.length === 0) {
    console.log('⚠️ Nenhum pagamento encontrado');
  } else {
    for (const pag of pagamentos) {
      console.log(`Empresa ID: ${pag.empresa_id}`);
      console.log(`Valor: R$ ${pag.valor}`);
      console.log(`Status: ${pag.status}`);
      console.log(`Data: ${pag.created_at}`);
      console.log('-'.repeat(40));
    }
  }

  console.log('\n✅ Verificação concluída!');
})();
