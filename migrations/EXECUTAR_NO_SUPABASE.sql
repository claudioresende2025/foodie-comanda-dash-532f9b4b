-- =====================================================
-- SCRIPT PARA CORRIGIR SUPER ADMIN E ASSINATURAS
-- Execute no Supabase Dashboard > SQL Editor
-- https://supabase.com/dashboard/project/jejpufnzaineihemdrgd/sql/new
-- =====================================================

-- PASSO 1: Listar usuários para verificar IDs
SELECT id, email, created_at 
FROM auth.users 
WHERE email IN ('claudinhoresendemoura@gmail.com', 'userteste@gmail.com')
ORDER BY created_at;

-- =====================================================
-- PASSO 2: Adicionar Super Admin
-- =====================================================
INSERT INTO public.super_admins (user_id, email, ativo, created_at)
SELECT 
  id as user_id,
  email,
  true as ativo,
  NOW() as created_at
FROM auth.users
WHERE email = 'claudinhoresendemoura@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET 
  ativo = true, 
  updated_at = NOW();

-- Verificar se foi criado
SELECT * FROM public.super_admins;

-- =====================================================
-- PASSO 3: Verificar profile e empresa do userteste
-- =====================================================
SELECT 
  p.id as profile_id, 
  p.email, 
  p.nome,
  p.empresa_id, 
  e.nome_fantasia
FROM public.profiles p
LEFT JOIN public.empresas e ON p.empresa_id = e.id
WHERE p.email = 'userteste@gmail.com';

-- =====================================================
-- PASSO 4: Criar assinatura (se a empresa existir)
-- =====================================================
-- Primeiro veja se retornou empresa_id no passo 3
-- Se sim, execute o INSERT abaixo:

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

-- Atualizar status da empresa
UPDATE public.empresas e
SET subscription_status = 'trialing'
FROM public.profiles p
WHERE p.email = 'userteste@gmail.com'
  AND e.id = p.empresa_id;

-- =====================================================
-- PASSO 5: Verificar resultados
-- =====================================================
SELECT 'SUPER ADMINS' as tabela;
SELECT * FROM public.super_admins;

SELECT 'ASSINATURAS' as tabela;
SELECT a.*, pl.nome as plano_nome
FROM public.assinaturas a
LEFT JOIN public.planos pl ON a.plano_id = pl.id;

SELECT 'EMPRESAS COM STATUS' as tabela;
SELECT id, nome_fantasia, subscription_status FROM public.empresas;
