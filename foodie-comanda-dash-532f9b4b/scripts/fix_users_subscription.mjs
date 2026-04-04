import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jejpufnzaineihemdrgd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplanB1Zm56YWluZWloZW1kcmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODgxMDAsImV4cCI6MjA4MDM2NDEwMH0.b0sXHLsReI8DOSN-IKz1PxSF9pQ3zjkkK1PKsCQkHMg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const USERS_TO_CHECK = [
  'userteste@gmail.com',
  'claudinhoresendemoura@gmail.com'
];

(async () => {
  console.log('🔍 Verificando usuários e suas configurações...\n');

  // 1. Buscar profiles dos usuários
  console.log('📋 PROFILES DOS USUÁRIOS:');
  console.log('='.repeat(80));
  
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*');
  
  if (profErr) {
    console.error('Erro ao buscar profiles:', profErr);
  } else {
    console.log('Total de profiles:', profiles?.length || 0);
    for (const p of profiles || []) {
      const isTarget = USERS_TO_CHECK.some(e => p.email?.toLowerCase() === e.toLowerCase());
      if (isTarget) {
        console.log('\n🎯 USUÁRIO ALVO ENCONTRADO:');
      }
      console.log(`  ID: ${p.id}`);
      console.log(`  Nome: ${p.nome}`);
      console.log(`  Email: ${p.email}`);
      console.log(`  Empresa ID: ${p.empresa_id || 'NÃO VINCULADO'}`);
      console.log(`  Role: ${p.role || 'N/A'}`);
      console.log('-'.repeat(40));
    }
  }

  // 2. Buscar user_roles (para verificar super_admin)
  console.log('\n📋 USER_ROLES:');
  console.log('='.repeat(80));
  
  const { data: userRoles, error: rolesErr } = await supabase
    .from('user_roles')
    .select('*');
  
  if (rolesErr) {
    console.error('Erro ao buscar user_roles:', rolesErr);
  } else {
    console.log('Total de user_roles:', userRoles?.length || 0);
    for (const r of userRoles || []) {
      console.log(`  User ID: ${r.user_id}`);
      console.log(`  Empresa ID: ${r.empresa_id}`);
      console.log(`  Role: ${r.role}`);
      console.log('-'.repeat(40));
    }
  }

  // 3. Buscar empresas
  console.log('\n📋 EMPRESAS:');
  console.log('='.repeat(80));
  
  const { data: empresas, error: empErr } = await supabase
    .from('empresas')
    .select('id, nome_fantasia, email, subscription_status');
  
  if (empErr) {
    console.error('Erro ao buscar empresas:', empErr);
  } else {
    for (const e of empresas || []) {
      console.log(`  ID: ${e.id}`);
      console.log(`  Nome: ${e.nome_fantasia}`);
      console.log(`  Email: ${e.email}`);
      console.log(`  Status Assinatura: ${e.subscription_status || 'N/A'}`);
      console.log('-'.repeat(40));
    }
  }

  // 4. Buscar assinaturas
  console.log('\n📋 ASSINATURAS:');
  console.log('='.repeat(80));
  
  const { data: assinaturas, error: assErr } = await supabase
    .from('assinaturas')
    .select('*');
  
  if (assErr) {
    console.error('Erro ao buscar assinaturas:', assErr);
  } else {
    console.log('Total de assinaturas:', assinaturas?.length || 0);
    if (assinaturas?.length === 0) {
      console.log('⚠️  NENHUMA ASSINATURA ENCONTRADA!');
    }
    for (const a of assinaturas || []) {
      console.log(`  Empresa ID: ${a.empresa_id}`);
      console.log(`  Plano ID: ${a.plano_id}`);
      console.log(`  Status: ${a.status}`);
      console.log('-'.repeat(40));
    }
  }

  // 5. Buscar planos disponíveis
  console.log('\n📋 PLANOS DISPONÍVEIS:');
  console.log('='.repeat(80));
  
  const { data: planos, error: planErr } = await supabase
    .from('planos')
    .select('id, nome, slug, ativo');
  
  if (planErr) {
    console.error('Erro ao buscar planos:', planErr);
  } else {
    for (const p of planos || []) {
      console.log(`  ID: ${p.id}`);
      console.log(`  Nome: ${p.nome}`);
      console.log(`  Slug: ${p.slug}`);
      console.log(`  Ativo: ${p.ativo}`);
      console.log('-'.repeat(40));
    }
  }

  // 6. Verificar tabela super_admins se existir
  console.log('\n📋 SUPER_ADMINS:');
  console.log('='.repeat(80));
  
  const { data: superAdmins, error: saErr } = await supabase
    .from('super_admins')
    .select('*');
  
  if (saErr) {
    console.log('Tabela super_admins não existe ou erro:', saErr.message);
  } else {
    console.log('Total de super_admins:', superAdmins?.length || 0);
    for (const sa of superAdmins || []) {
      console.log(`  User ID: ${sa.user_id}`);
      console.log(`  Email: ${sa.email}`);
      console.log('-'.repeat(40));
    }
  }

  console.log('\n✅ Verificação concluída!');
})();
