-- ===========================================
-- EXECUTAR NO SUPABASE DASHBOARD SQL EDITOR
-- Data: 20/03/2026
-- Corrige: Toggle de delivery não aparecendo/desaparecendo
-- ===========================================

-- 1. Remover TODAS as políticas existentes de config_delivery
DROP POLICY IF EXISTS "config_delivery_public_read" ON public.config_delivery;
DROP POLICY IF EXISTS "Public can view active delivery config" ON public.config_delivery;
DROP POLICY IF EXISTS "config_delivery_staff_all" ON public.config_delivery;
DROP POLICY IF EXISTS "Staff can manage delivery config" ON public.config_delivery;
DROP POLICY IF EXISTS "config_delivery_public_select" ON public.config_delivery;
DROP POLICY IF EXISTS "config_delivery_staff_manage" ON public.config_delivery;

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.config_delivery ENABLE ROW LEVEL SECURITY;

-- 3. Criar política CORRETA para leitura pública
-- IMPORTANTE: Usa 'delivery_ativo' (não 'ativo')
-- Quando delivery_ativo = false, clientes NÃO veem o restaurante
CREATE POLICY "config_delivery_public_select"
  ON public.config_delivery FOR SELECT
  USING (delivery_ativo = true);

-- 4. Criar política para staff gerenciar
-- Staff pode ver e editar TODAS as configs da sua empresa
CREATE POLICY "config_delivery_staff_manage"
  ON public.config_delivery FOR ALL
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- 5. Habilitar realtime para config_delivery
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'config_delivery'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.config_delivery;
        RAISE NOTICE 'config_delivery adicionada ao realtime';
    END IF;
END $$;

-- 6. Verificar resultado
SELECT 
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'config_delivery';
