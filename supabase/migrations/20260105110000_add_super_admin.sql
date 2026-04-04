-- ============================================
-- Adicionar Super Admin manualmente
-- ============================================

-- Adicionar o usuário como super admin
INSERT INTO public.super_admins (user_id, nome, email, ativo, permissoes)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'nome', email),
  email,
  true,
  '["all"]'::jsonb
FROM auth.users
WHERE email = 'claudinhoresendemoura@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  ativo = true,
  permissoes = '["all"]'::jsonb;

-- Verificar
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.super_admins WHERE ativo = true;
  RAISE NOTICE '✅ Super Admins ativos: %', v_count;
END $$;
