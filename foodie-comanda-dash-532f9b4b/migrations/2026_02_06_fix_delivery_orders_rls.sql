-- Migration: Corrige política RLS de pedidos_delivery para clientes
-- Data: 2026-02-06
-- Problema: Clientes não conseguem ver seus próprios pedidos na página delivery/orders

-- Dropar políticas existentes de SELECT
DROP POLICY IF EXISTS "users_view_own_delivery_orders" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Allow public view delivery orders" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Allow authenticated view own orders" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_select" ON public.pedidos_delivery;

-- Criar política que permite:
-- 1. Clientes verem seus próprios pedidos (por user_id)
-- 2. Staff verem pedidos da empresa
CREATE POLICY "pedidos_delivery_select_own_or_staff"
  ON public.pedidos_delivery FOR SELECT
  USING (
    -- Cliente vê seus próprios pedidos
    auth.uid() = user_id 
    OR 
    -- Staff vê pedidos da empresa
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.empresa_id = pedidos_delivery.empresa_id
    )
    OR
    -- Proprietário vê pedidos da empresa
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN empresas e ON e.usuario_proprietario_id = p.id
      WHERE p.id = auth.uid()
      AND e.id = pedidos_delivery.empresa_id
    )
  );

-- Garantir que itens_delivery também são visíveis
DROP POLICY IF EXISTS "itens_delivery_select" ON public.itens_delivery;
DROP POLICY IF EXISTS "Allow public view delivery items" ON public.itens_delivery;

CREATE POLICY "itens_delivery_select_via_pedido"
  ON public.itens_delivery FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_delivery pd
      WHERE pd.id = itens_delivery.pedido_delivery_id
      AND (
        auth.uid() = pd.user_id 
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.empresa_id = pd.empresa_id
        )
      )
    )
  );

-- Comentário
COMMENT ON POLICY "pedidos_delivery_select_own_or_staff" ON public.pedidos_delivery IS 
  'Permite clientes verem seus próprios pedidos e staff ver pedidos da empresa';
