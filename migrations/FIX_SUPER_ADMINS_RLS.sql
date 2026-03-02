-- ============================================================================
-- FIX: Corrigir RLS da tabela super_admins + Função RPC
-- Executar no Supabase SQL Editor (EXECUTE TUDO DE UMA VEZ)
-- Data: 2026-03-02
-- ============================================================================

-- ============================================================================
-- PASSO 1: Verificar dados atuais
-- ============================================================================
SELECT * FROM super_admins;

-- Verificar se user_id está preenchido olhando auth.users
SELECT sa.*, au.email as auth_email
FROM super_admins sa
LEFT JOIN auth.users au ON au.id = sa.user_id;

-- ============================================================================
-- PASSO 2: Adicionar colunas faltantes (SE NECESSÁRIO)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'super_admins' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.super_admins ADD COLUMN email VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'super_admins' AND column_name = 'nome'
  ) THEN
    ALTER TABLE public.super_admins ADD COLUMN nome VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'super_admins' AND column_name = 'permissoes'
  ) THEN
    ALTER TABLE public.super_admins ADD COLUMN permissoes JSONB DEFAULT '["all"]'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- PASSO 3: Inserir/Atualizar Super Admin (claudinhoresendemoura@gmail.com)
-- ============================================================================
INSERT INTO public.super_admins (user_id, email, nome, ativo, permissoes)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'nome', 'Super Admin'),
  true,
  '["all"]'::jsonb
FROM auth.users
WHERE email = 'claudinhoresendemoura@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  nome = EXCLUDED.nome,
  ativo = true,
  permissoes = '["all"]'::jsonb;

-- ============================================================================
-- PASSO 4: CRIAR FUNÇÃO RPC check_is_super_admin (USADA PELO FRONT-END)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid() AND ativo = true
  );
END;
$$;

-- Dar permissão para authenticated chamar a função
GRANT EXECUTE ON FUNCTION public.check_is_super_admin() TO authenticated;

-- ============================================================================
-- PASSO 5: CRIAR FUNÇÃO is_super_admin (ALTERNATIVA)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = p_user_id AND ativo = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;

-- ============================================================================
-- PASSO 6: Remover policies existentes
-- ============================================================================
DROP POLICY IF EXISTS "Super admins podem ver a si mesmos" ON super_admins;
DROP POLICY IF EXISTS "Super admins podem ver tabela super_admins" ON super_admins;
DROP POLICY IF EXISTS "super_admins_select_policy" ON super_admins;
DROP POLICY IF EXISTS "super_admins_select" ON super_admins;
DROP POLICY IF EXISTS "Users can check their own super_admin status" ON super_admins;
DROP POLICY IF EXISTS "Users can check own super_admin status" ON super_admins;
DROP POLICY IF EXISTS "Super admins can view all" ON super_admins;
DROP POLICY IF EXISTS "allow_select_super_admins" ON super_admins;
DROP POLICY IF EXISTS "Super admins full access" ON super_admins;
DROP POLICY IF EXISTS "super_admins_select_self" ON super_admins;
DROP POLICY IF EXISTS "super_admins_service_role" ON super_admins;

-- ============================================================================
-- PASSO 7: Habilitar RLS
-- ============================================================================
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASSO 8: Criar policy que permite usuários verificarem seu próprio status
-- ============================================================================
CREATE POLICY "Users can check own super_admin status"
ON super_admins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- PASSO 9: Criar policy para service_role
-- ============================================================================
CREATE POLICY "Service role full access"
ON super_admins
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PASSO 10: Verificar resultado
-- ============================================================================

-- Ver policies criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'super_admins';

-- Verificar dados finais
SELECT sa.*, au.email as auth_email
FROM super_admins sa
LEFT JOIN auth.users au ON au.id = sa.user_id;

-- Testar função (quando logado)
-- SELECT public.check_is_super_admin();

-- ============================================================================
-- RESULTADO ESPERADO:
-- ============================================================================
-- 1. Usuário claudinhoresendemoura@gmail.com na tabela super_admins com ativo=true
-- 2. Função check_is_super_admin() criada
-- 3. Função is_super_admin(UUID) criada
-- 4. RLS habilitada com 2 políticas:
--    - "Users can check own super_admin status" (SELECT)
--    - "Service role full access" (ALL)
-- ============================================================================
