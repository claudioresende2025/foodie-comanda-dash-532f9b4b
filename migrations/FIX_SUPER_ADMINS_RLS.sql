-- ============================================================================
-- FIX: Corrigir RLS da tabela super_admins
-- Executar no Supabase SQL Editor (EXECUTE LINHA POR LINHA ou em blocos)
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
-- PASSO 2: ATUALIZAR o user_id usando o email (MUITO IMPORTANTE!)
-- O user_id DEVE corresponder ao id do auth.users
-- ============================================================================
UPDATE super_admins sa
SET user_id = au.id
FROM auth.users au
WHERE au.email = sa.email
  AND (sa.user_id IS NULL OR sa.user_id != au.id);

-- ============================================================================
-- PASSO 3: Remover policies existentes
-- ============================================================================
DROP POLICY IF EXISTS "Super admins podem ver tabela super_admins" ON super_admins;
DROP POLICY IF EXISTS "super_admins_select_policy" ON super_admins;
DROP POLICY IF EXISTS "Users can check their own super_admin status" ON super_admins;
DROP POLICY IF EXISTS "Users can check own super_admin status" ON super_admins;
DROP POLICY IF EXISTS "Super admins can view all" ON super_admins;
DROP POLICY IF EXISTS "allow_select_super_admins" ON super_admins;

-- ============================================================================
-- PASSO 4: Habilitar RLS
-- ============================================================================
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASSO 5: Criar policy que permite usuários verificarem seu próprio status
-- ============================================================================
CREATE POLICY "Users can check own super_admin status"
ON super_admins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- PASSO 6: Criar policy que permite super admins gerenciarem tudo
-- ============================================================================
CREATE POLICY "Super admins full access"
ON super_admins
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM super_admins sa 
    WHERE sa.user_id = auth.uid() 
    AND sa.ativo = true
  )
);

-- ============================================================================
-- PASSO 7: Verificar resultado
-- ============================================================================

-- Ver policies criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'super_admins';

-- Verificar dados finais
SELECT sa.*, au.email as auth_email
FROM super_admins sa
LEFT JOIN auth.users au ON au.id = sa.user_id;
