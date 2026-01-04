-- ===========================================
-- EXECUTE ESTE SQL NO SUPABASE DASHBOARD
-- (SQL Editor -> New Query)
-- ===========================================

-- Limpar todas as políticas de pedidos_delivery
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'pedidos_delivery' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.pedidos_delivery';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'itens_delivery' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.itens_delivery';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'enderecos_cliente' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.enderecos_cliente';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.pedidos_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;

-- Staff can view all orders from their empresa (usando profiles)
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
    OR auth.uid() IS NOT NULL
  );

-- Staff can update orders from their empresa
CREATE POLICY "staff_update_delivery_orders"
  ON public.pedidos_delivery FOR UPDATE
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- Public can view all delivery items
CREATE POLICY "public_view_delivery_items"
  ON public.itens_delivery FOR SELECT
  USING (true);

-- Authenticated can insert delivery items
CREATE POLICY "authenticated_insert_delivery_items"
  ON public.itens_delivery FOR INSERT
  WITH CHECK (true);

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

-- Confirmar resultado
SELECT 'Policies created successfully!' as status;
