-- =====================================================
-- SCRIPT PARA CORRIGIR SUPER ADMIN E ASSINATURAS
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. ADICIONAR SUPER ADMIN para claudinhoresendemoura@gmail.com
-- Primeiro, precisamos encontrar o user_id do usuário no auth.users

-- Visualizar usuários cadastrados no auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email IN ('claudinhoresendemoura@gmail.com', 'userteste@gmail.com')
ORDER BY created_at;

-- 2. Inserir super admin (substitua USER_ID_AQUI pelo ID real retornado acima)
-- INSERT INTO public.super_admins (user_id, email, ativo, created_at)
-- VALUES (
--   'USER_ID_AQUI', -- ID do claudinhoresendemoura@gmail.com
--   'claudinhoresendemoura@gmail.com',
--   true,
--   NOW()
-- )
-- ON CONFLICT (user_id) DO UPDATE SET ativo = true;

-- 3. Verificar profiles existentes
SELECT * FROM public.profiles;

-- 4. Verificar empresas existentes
SELECT id, nome_fantasia, subscription_status FROM public.empresas;

-- 5. Verificar assinaturas existentes
SELECT * FROM public.assinaturas;

-- 6. Verificar planos disponíveis
SELECT id, nome, slug, preco_mensal, ativo FROM public.planos;

-- =====================================================
-- DEPOIS DE IDENTIFICAR OS IDs, EXECUTE OS INSERTS ABAIXO
-- =====================================================

-- Para adicionar o Super Admin:
-- DESCOMENTE E SUBSTITUA O USER_ID REAL:

/*
INSERT INTO public.super_admins (user_id, email, ativo, created_at)
SELECT 
  id,
  email,
  true,
  NOW()
FROM auth.users
WHERE email = 'claudinhoresendemoura@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET ativo = true, updated_at = NOW();
*/

-- Para criar assinatura para userteste@gmail.com:
-- (Primeiro precisamos saber qual empresa está vinculada a esse usuário)

/*
-- Encontrar empresa do userteste@gmail.com
SELECT p.id as profile_id, p.email, p.empresa_id, e.nome_fantasia
FROM public.profiles p
LEFT JOIN public.empresas e ON p.empresa_id = e.id
WHERE p.email = 'userteste@gmail.com';

-- Se a empresa existir, criar assinatura com plano Bronze (trial)
INSERT INTO public.assinaturas (
  empresa_id,
  plano_id,
  status,
  periodo,
  trial_start,
  trial_end,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
SELECT 
  p.empresa_id,
  (SELECT id FROM public.planos WHERE slug = 'bronze' OR nome ILIKE '%bronze%' LIMIT 1),
  'trialing',
  'mensal',
  NOW(),
  NOW() + INTERVAL '7 days',
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
FROM public.profiles p
WHERE p.email = 'userteste@gmail.com'
  AND p.empresa_id IS NOT NULL
ON CONFLICT (empresa_id) DO UPDATE SET 
  status = 'trialing',
  trial_end = NOW() + INTERVAL '7 days',
  updated_at = NOW();
*/
