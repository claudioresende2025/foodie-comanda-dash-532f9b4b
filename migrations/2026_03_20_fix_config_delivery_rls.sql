-- ===========================================
-- CORREÇÃO DA POLÍTICA RLS DE CONFIG_DELIVERY
-- Corrige o filtro para usar delivery_ativo
-- ===========================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "config_delivery_public_read" ON public.config_delivery;
DROP POLICY IF EXISTS "Public can view active delivery config" ON public.config_delivery;
DROP POLICY IF EXISTS "config_delivery_staff_all" ON public.config_delivery;
DROP POLICY IF EXISTS "Staff can manage delivery config" ON public.config_delivery;

-- Garantir que RLS está habilitado
ALTER TABLE public.config_delivery ENABLE ROW LEVEL SECURITY;

-- Política CORRETA para leitura pública: usa delivery_ativo
CREATE POLICY "config_delivery_public_select"
  ON public.config_delivery FOR SELECT
  USING (delivery_ativo = true);

-- Política para staff gerenciar (insert, update, delete e select completo)
CREATE POLICY "config_delivery_staff_manage"
  ON public.config_delivery FOR ALL
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- Adicionar comentário para documentação
COMMENT ON POLICY "config_delivery_public_select" ON public.config_delivery IS 
  'Permite leitura pública apenas de configs com delivery_ativo = true';
