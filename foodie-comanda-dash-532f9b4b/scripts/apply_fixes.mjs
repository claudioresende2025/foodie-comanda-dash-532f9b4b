import { createClient } from '@supabase/supabase-js';

// ================================================
// CONFIGURAÇÃO - Substitua pelo seu SERVICE_ROLE_KEY
// Pegue em: Supabase Dashboard > Settings > API > service_role key
// ================================================
const SUPABASE_URL = 'https://jejpufnzaineihemdrgd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'COLE_SUA_SERVICE_ROLE_KEY_AQUI';

if (SUPABASE_SERVICE_KEY === 'COLE_SUA_SERVICE_ROLE_KEY_AQUI') {
  console.error('❌ ERRO: Você precisa configurar a SERVICE_ROLE_KEY!');
  console.log('\n📌 Como obter:');
  console.log('1. Acesse: https://supabase.com/dashboard/project/jejpufnzaineihemdrgd/settings/api');
  console.log('2. Copie a "service_role" key (NÃO a anon key)');
  console.log('3. Execute: set SUPABASE_SERVICE_KEY=sua_key_aqui && node scripts/apply_fixes.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const SUPER_ADMIN_EMAIL = 'claudinhoresendemoura@gmail.com';
const USER_TEST_EMAIL = 'userteste@gmail.com';

async function main() {
  console.log('🔧 Iniciando correções...\n');

  // 1. Buscar todos os usuários do auth.users via API admin
  console.log('📋 Buscando usuários cadastrados...');
  
  const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers();
  
  if (usersErr) {
    console.error('Erro ao buscar usuários:', usersErr);
    return;
  }

  console.log(`Total de usuários: ${users?.length || 0}`);
  
  const superAdminUser = users?.find(u => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
  const testUser = users?.find(u => u.email?.toLowerCase() === USER_TEST_EMAIL.toLowerCase());

  console.log('\n📌 Usuários encontrados:');
  if (superAdminUser) {
    console.log(`✅ Super Admin: ${superAdminUser.email} (ID: ${superAdminUser.id})`);
  } else {
    console.log(`❌ Super Admin não encontrado: ${SUPER_ADMIN_EMAIL}`);
  }
  
  if (testUser) {
    console.log(`✅ User Teste: ${testUser.email} (ID: ${testUser.id})`);
  } else {
    console.log(`❌ User Teste não encontrado: ${USER_TEST_EMAIL}`);
  }

  // 2. Inserir Super Admin
  if (superAdminUser) {
    console.log('\n🔐 Configurando Super Admin...');
    
    const { data: existingSA, error: saCheckErr } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', superAdminUser.id)
      .single();

    if (existingSA) {
      console.log('Super Admin já existe, atualizando para ativo...');
      const { error: updateErr } = await supabase
        .from('super_admins')
        .update({ ativo: true, updated_at: new Date().toISOString() })
        .eq('user_id', superAdminUser.id);
      
      if (updateErr) {
        console.error('Erro ao atualizar super admin:', updateErr);
      } else {
        console.log('✅ Super Admin atualizado com sucesso!');
      }
    } else {
      console.log('Criando registro de Super Admin...');
      const { error: insertErr } = await supabase
        .from('super_admins')
        .insert({
          user_id: superAdminUser.id,
          email: superAdminUser.email,
          ativo: true,
          created_at: new Date().toISOString()
        });
      
      if (insertErr) {
        console.error('Erro ao inserir super admin:', insertErr);
      } else {
        console.log('✅ Super Admin criado com sucesso!');
      }
    }
  }

  // 3. Verificar profile e empresa do user teste
  if (testUser) {
    console.log('\n👤 Verificando profile do user teste...');
    
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUser.id)
      .single();

    if (profErr) {
      console.log('Profile não encontrado, criando...');
      const { error: createProfErr } = await supabase
        .from('profiles')
        .insert({
          id: testUser.id,
          email: testUser.email,
          nome: testUser.user_metadata?.nome || 'User Teste',
          created_at: new Date().toISOString()
        });
      
      if (createProfErr) {
        console.error('Erro ao criar profile:', createProfErr);
      } else {
        console.log('✅ Profile criado!');
      }
    } else {
      console.log(`Profile encontrado: ${profile.nome} (empresa_id: ${profile.empresa_id || 'NÃO VINCULADO'})`);
    }

    // 4. Verificar se tem empresa vinculada
    const { data: profileData } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('id', testUser.id)
      .single();

    if (profileData?.empresa_id) {
      console.log(`\n🏢 Empresa vinculada: ${profileData.empresa_id}`);
      
      // 5. Verificar/Criar assinatura
      console.log('\n💳 Verificando assinatura...');
      
      const { data: assinatura, error: assErr } = await supabase
        .from('assinaturas')
        .select('*')
        .eq('empresa_id', profileData.empresa_id)
        .single();

      if (assinatura) {
        console.log(`Assinatura existente: Status = ${assinatura.status}`);
      } else {
        console.log('Assinatura não encontrada, criando trial...');
        
        // Buscar plano Bronze
        const { data: plano } = await supabase
          .from('planos')
          .select('id, nome')
          .or('slug.eq.bronze,nome.ilike.%bronze%')
          .single();

        if (plano) {
          const now = new Date();
          const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dias
          const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias

          const { error: createAssErr } = await supabase
            .from('assinaturas')
            .insert({
              empresa_id: profileData.empresa_id,
              plano_id: plano.id,
              status: 'trialing',
              periodo: 'mensal',
              trial_start: now.toISOString(),
              trial_end: trialEnd.toISOString(),
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              created_at: now.toISOString(),
              updated_at: now.toISOString()
            });

          if (createAssErr) {
            console.error('Erro ao criar assinatura:', createAssErr);
          } else {
            console.log(`✅ Assinatura criada com plano ${plano.nome} (trial de 7 dias)!`);
            
            // Atualizar status na empresa
            await supabase
              .from('empresas')
              .update({ subscription_status: 'trialing' })
              .eq('id', profileData.empresa_id);
          }
        } else {
          console.error('❌ Plano Bronze não encontrado!');
        }
      }
    } else {
      console.log('\n⚠️ User teste não tem empresa vinculada!');
      console.log('O usuário precisa completar o onboarding para criar uma empresa.');
    }
  }

  console.log('\n✅ Processo concluído!');
  console.log('\n📌 Próximos passos:');
  console.log('1. Faça logout e login novamente no sistema');
  console.log('2. Acesse /super-admin com claudinhoresendemoura@gmail.com');
  console.log('3. Acesse /admin/assinatura com userteste@gmail.com');
}

main().catch(console.error);
