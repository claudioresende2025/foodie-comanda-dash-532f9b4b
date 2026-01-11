import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jejpufnzaineihemdrgd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplanB1Zm56YWluZWloZW1kcmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODgxMDAsImV4cCI6MjA4MDM2NDEwMH0.b0sXHLsReI8DOSN-IKz1PxSF9pQ3zjkkK1PKsCQkHMg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Substitua pelo empresa_id correto
const EMPRESA_ID = process.argv[2];

if (!EMPRESA_ID) {
  console.log('❌ Uso: node scripts/create_subscription.mjs <empresa_id>');
  console.log('\nEmpresas disponíveis:');
  
  (async () => {
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id, nome_fantasia')
      .limit(20);
    
    for (const emp of empresas || []) {
      console.log(`  ${emp.id} - ${emp.nome_fantasia}`);
    }
  })();
} else {
  (async () => {
    console.log(`🔧 Criando assinatura para empresa: ${EMPRESA_ID}`);
    
    // Verificar se empresa existe
    const { data: empresa, error: empErr } = await supabase
      .from('empresas')
      .select('id, nome_fantasia')
      .eq('id', EMPRESA_ID)
      .single();
    
    if (empErr || !empresa) {
      console.error('❌ Empresa não encontrada:', empErr);
      return;
    }
    
    console.log(`✅ Empresa encontrada: ${empresa.nome_fantasia}`);
    
    // Buscar plano (pegando o primeiro ativo)
    const { data: plano, error: planoErr } = await supabase
      .from('planos')
      .select('id, nome')
      .eq('ativo', true)
      .limit(1)
      .single();
    
    if (planoErr) {
      console.log('⚠️ Nenhum plano encontrado, criando assinatura sem plano_id');
    } else {
      console.log(`✅ Plano encontrado: ${plano?.nome}`);
    }
    
    // Criar assinatura
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias de trial
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias
    
    const assinaturaData = {
      empresa_id: EMPRESA_ID,
      plano_id: plano?.id || null,
      status: 'active', // ou 'trialing' se quiser trial
      periodo: 'mensal',
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    
    const { data: assinatura, error: assErr } = await supabase
      .from('assinaturas')
      .upsert(assinaturaData, { onConflict: 'empresa_id' })
      .select()
      .single();
    
    if (assErr) {
      console.error('❌ Erro ao criar assinatura:', assErr);
      return;
    }
    
    console.log('✅ Assinatura criada com sucesso!');
    console.log('📄 Detalhes:', assinatura);
  })();
}
