import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  console.log('🔍 Iniciando debug do create-subscription-checkout...');

  // 1. Buscar um plano válido (Profissional / Prata)
  const { data: planos, error: planosError } = await supabase
    .from('planos')
    .select('id, nome, stripe_price_id_mensal')
    .ilike('nome', '%Profissional%') // Tenta achar o plano Profissional
    .limit(1);

  if (planosError || !planos || planos.length === 0) {
    console.error('❌ Erro ao buscar plano Profissional:', planosError);
    // Tenta qualquer plano
    const { data: anyPlan } = await supabase.from('planos').select('id, nome').limit(1);
    if (!anyPlan || anyPlan.length === 0) {
      console.error('❌ Nenhum plano encontrado no banco!');
      return;
    }
    console.log('⚠️ Usando fallback de plano:', anyPlan[0]);
    planos[0] = anyPlan[0];
  }

  const plano = planos[0];
  console.log('✅ Plano selecionado:', plano);

  // 2. Buscar uma empresa válida (ou usar ID fixo se soubermos)
  // Vamos tentar pegar a primeira empresa que encontrarmos
  const { data: empresas, error: empError } = await supabase
    .from('empresas')
    .select('id')
    .limit(1);

  if (empError || !empresas || empresas.length === 0) {
    console.error('❌ Erro ao buscar empresa:', empError);
    return;
  }

  const empresa = empresas[0];
  console.log('✅ Empresa selecionada:', empresa);

  // 3. Invocar a Edge Function
  console.log('\n🚀 Invocando create-subscription-checkout...');
  
  const payload = {
    planoId: plano.id,
    empresaId: empresa.id,
    periodo: 'mensal',
    successUrl: 'http://localhost:3000/success',
    cancelUrl: 'http://localhost:3000/cancel',
    trial_days: 0
  };

  try {
    const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
      body: payload
    });

    if (error) {
      console.error('❌ Erro retornado pela Function (Client Error):');
      console.error(error);
      
      // Tentar ler o corpo da resposta se disponível no erro
      if (error && error.context && error.context.json) {
         try {
             const json = await error.context.json();
             console.error('Body JSON:', json);
         } catch(e) { 
             console.error('Não foi possível ler JSON do erro');
         }
      }
    } else {
      console.log('✅ Sucesso! Resposta da Function:');
      console.log(data);
    }

  } catch (e) {
    console.error('❌ Exceção ao invocar function:', e);
  }

})();
