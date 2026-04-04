-- ============================================================================
-- FIX: Corrigir RLS para INSERT na tabela empresas
-- Executar no Supabase SQL Editor
-- Data: 2026-03-02
-- ============================================================================

-- 1. Verificar se a tabela empresas tem RLS habilitada
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'empresas';

-- 2. Ver políticas atuais
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'empresas';

-- 3. Remover políticas conflitantes
DROP POLICY IF EXISTS "empresas_insert" ON public.empresas;
DROP POLICY IF EXISTS "Empresas insert auth" ON public.empresas;
DROP POLICY IF EXISTS "enable_insert_for_authenticated_user" ON public.empresas;

-- 4. Criar política de INSERT permissiva
CREATE POLICY "empresas_insert_authenticated"
  ON public.empresas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Garantir que RLS está habilitada
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- 6. Verificar colunas da tabela empresas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'empresas'
ORDER BY ordinal_position;

-- 7. Verificar se usuario_proprietario_id existe
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'empresas' AND column_name = 'usuario_proprietario_id'
) as coluna_existe;

-- Verificar resultado final
SELECT policyname, cmd, permissive, roles
FROM pg_policies 
WHERE tablename = 'empresas';
