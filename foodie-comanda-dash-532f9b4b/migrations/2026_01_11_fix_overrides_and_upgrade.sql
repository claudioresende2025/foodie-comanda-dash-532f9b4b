-- ============================================================
-- MIGRATION: Corrigir função upsert_empresa_overrides + upgrade de plano
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. RECRIAR FUNÇÃO RPC com SECURITY DEFINER (bypass RLS)
DROP FUNCTION IF EXISTS public.upsert_empresa_overrides(uuid, jsonb, integer, integer);
DROP FUNCTION IF EXISTS public.upsert_empresa_overrides(uuid, jsonb, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.upsert_empresa_overrides(
  p_empresa_id uuid,
  p_overrides jsonb DEFAULT NULL,
  p_kds_screens_limit integer DEFAULT NULL,
  p_staff_limit integer DEFAULT NULL,
  p_mesas_limit integer DEFAULT NULL,
  p_garcom_limit integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Executa com privilégios do owner (bypassa RLS)
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.empresa_overrides (
    empresa_id, 
    overrides, 
    kds_screens_limit, 
    staff_limit, 
    mesas_limit, 
    garcom_limit, 
    created_at, 
    updated_at
  )
  VALUES (
    p_empresa_id, 
    COALESCE(p_overrides, '{}'::jsonb), 
    p_kds_screens_limit, 
    p_staff_limit, 
    p_mesas_limit, 
    p_garcom_limit, 
    now(), 
    now()
  )
  ON CONFLICT (empresa_id) DO UPDATE
    SET 
      overrides = CASE 
        WHEN p_overrides IS NOT NULL THEN p_overrides 
        ELSE empresa_overrides.overrides 
      END,
      kds_screens_limit = COALESCE(p_kds_screens_limit, empresa_overrides.kds_screens_limit),
      staff_limit = COALESCE(p_staff_limit, empresa_overrides.staff_limit),
      mesas_limit = COALESCE(p_mesas_limit, empresa_overrides.mesas_limit),
      garcom_limit = COALESCE(p_garcom_limit, empresa_overrides.garcom_limit),
      updated_at = now();
END;
$$;

-- Dar permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.upsert_empresa_overrides(uuid, jsonb, integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_empresa_overrides(uuid, jsonb, integer, integer, integer, integer) TO service_role;

-- 2. GARANTIR RLS na tabela empresa_overrides (mas permitir via função)
ALTER TABLE public.empresa_overrides ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT (usuários podem ver overrides da própria empresa)
DROP POLICY IF EXISTS "Users can view own empresa overrides" ON public.empresa_overrides;
CREATE POLICY "Users can view own empresa overrides"
ON public.empresa_overrides FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
);

-- Policy para INSERT/UPDATE via super_admin ou service_role
DROP POLICY IF EXISTS "Super admins can manage empresa overrides" ON public.empresa_overrides;
CREATE POLICY "Super admins can manage empresa overrides"
ON public.empresa_overrides FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
);

-- 3. VERIFICAR PLANOS DISPONÍVEIS
SELECT id, nome, slug, preco_mensal FROM public.planos ORDER BY preco_mensal;

-- 4. VERIFICAR ASSINATURA ATUAL DA EMPRESA
-- (Substitua o empresa_id se necessário)
SELECT 
  a.id as assinatura_id,
  a.empresa_id,
  a.plano_id,
  a.status,
  p.nome as plano_nome,
  p.slug as plano_slug
FROM public.assinaturas a
LEFT JOIN public.planos p ON a.plano_id = p.id
WHERE a.empresa_id = '36bed87c-8c3e-45ab-a6cc-b3ab832b9f9f';

-- ============================================================
-- 5. PARA FAZER UPGRADE MANUAL PARA PLANO PRATA:
-- Descomente e execute as linhas abaixo após verificar os IDs
-- ============================================================

-- Primeiro, encontre o ID do plano Prata:
-- SELECT id FROM public.planos WHERE slug = 'prata' OR nome ILIKE '%prata%';

-- Depois, atualize a assinatura:
-- UPDATE public.assinaturas 
-- SET plano_id = (SELECT id FROM public.planos WHERE slug = 'prata' LIMIT 1),
--     updated_at = now()
-- WHERE empresa_id = '36bed87c-8c3e-45ab-a6cc-b3ab832b9f9f';

-- ============================================================
-- 6. VERIFICAR SE O UPGRADE FOI APLICADO
-- ============================================================
-- SELECT 
--   a.empresa_id,
--   p.nome as plano_atual,
--   p.slug,
--   a.status
-- FROM public.assinaturas a
-- JOIN public.planos p ON a.plano_id = p.id
-- WHERE a.empresa_id = '36bed87c-8c3e-45ab-a6cc-b3ab832b9f9f';
