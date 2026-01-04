-- Fix delivery policies to allow staff to view orders
-- Drop existing policies first

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all policies from pedidos_delivery
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'pedidos_delivery' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.pedidos_delivery';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy % on pedidos_delivery: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    -- Drop all policies from itens_delivery
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'itens_delivery' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.itens_delivery';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy % on itens_delivery: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    -- Drop all policies from enderecos_cliente
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'enderecos_cliente' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.enderecos_cliente';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy % on enderecos_cliente: %', r.policyname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.pedidos_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Policies for pedidos_delivery
-- ============================================

-- Staff can view all orders from their empresa (using profiles table instead of user_roles)
CREATE POLICY "staff_view_empresa_delivery_orders"
  ON public.pedidos_delivery FOR SELECT
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- Users can view their own orders
CREATE POLICY "users_view_own_delivery_orders"
  ON public.pedidos_delivery FOR SELECT
  USING (auth.uid() = user_id);

-- Public can view orders with stripe payment
CREATE POLICY "public_view_paid_orders"
  ON public.pedidos_delivery FOR SELECT
  USING (stripe_payment_id IS NOT NULL);

-- Staff can insert orders
CREATE POLICY "staff_insert_delivery_orders"
  ON public.pedidos_delivery FOR INSERT
  WITH CHECK (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- Service role / authenticated can insert
CREATE POLICY "authenticated_insert_delivery_orders"
  ON public.pedidos_delivery FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'service_role');

-- Staff can update orders from their empresa
CREATE POLICY "staff_update_delivery_orders"
  ON public.pedidos_delivery FOR UPDATE
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- ============================================
-- Policies for itens_delivery
-- ============================================

-- Public can view all items (they need pedido_delivery to be accessible)
CREATE POLICY "public_view_delivery_items"
  ON public.itens_delivery FOR SELECT
  USING (true);

-- Authenticated can insert items
CREATE POLICY "authenticated_insert_delivery_items"
  ON public.itens_delivery FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Policies for enderecos_cliente
-- ============================================

-- Users can view their own addresses
CREATE POLICY "users_view_own_addresses"
  ON public.enderecos_cliente FOR SELECT
  USING (auth.uid() = user_id);

-- Staff can view addresses linked to their empresa orders
CREATE POLICY "staff_view_delivery_addresses"
  ON public.enderecos_cliente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_delivery pd 
      WHERE pd.endereco_id = enderecos_cliente.id
      AND pd.empresa_id IN (
        SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
      )
    )
  );

-- Users can create their own addresses
CREATE POLICY "users_create_addresses"
  ON public.enderecos_cliente FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own addresses
CREATE POLICY "users_update_addresses"
  ON public.enderecos_cliente FOR UPDATE
  USING (auth.uid() = user_id);
