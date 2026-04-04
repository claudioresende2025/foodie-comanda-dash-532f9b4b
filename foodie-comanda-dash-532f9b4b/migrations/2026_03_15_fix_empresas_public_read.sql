-- Fix: Garantir que clientes delivery possam ler a chave_pix das empresas
-- O problema é que a política de RLS pode estar bloqueando o acesso a algumas colunas

-- Remover políticas anteriores que possam estar conflitando
DROP POLICY IF EXISTS "empresas_select_public" ON public.empresas;
DROP POLICY IF EXISTS "empresas_public_read" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select_all" ON public.empresas;
DROP POLICY IF EXISTS "Permitir leitura publica empresas" ON public.empresas;

-- Criar política que permite leitura pública de TODAS as colunas (incluindo chave_pix)
-- Isso é necessário para que clientes de delivery possam ver a chave PIX para pagamento
CREATE POLICY "empresas_select_public" ON public.empresas
FOR SELECT
TO public
USING (true);

-- Manter políticas de escrita apenas para autenticados
DROP POLICY IF EXISTS "empresas_insert_authenticated" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_authenticated" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert_auth" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_owner" ON public.empresas;

CREATE POLICY "empresas_insert_authenticated" ON public.empresas
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "empresas_update_authenticated" ON public.empresas
FOR UPDATE
TO authenticated
USING (
  id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superadmin = true)
);

-- Verificar se a chave_pix está corretamente salva
-- Execute este SELECT para verificar:
-- SELECT id, nome_fantasia, chave_pix FROM empresas WHERE chave_pix IS NOT NULL;
