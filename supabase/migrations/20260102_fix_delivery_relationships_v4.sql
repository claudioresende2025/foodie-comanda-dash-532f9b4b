-- Fix delivery relationships - V4 (Final Safe version)
-- Adds columns first, then handles policies without errors

-- ============================================
-- PART 1: Add all missing columns FIRST
-- ============================================

DO $$ 
BEGIN
  -- Add stripe_payment_id
  BEGIN
    ALTER TABLE public.pedidos_delivery ADD COLUMN stripe_payment_id TEXT;
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'Column stripe_payment_id already exists';
  END;

  -- Add stripe_payment_status
  BEGIN
    ALTER TABLE public.pedidos_delivery ADD COLUMN stripe_payment_status TEXT;
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'Column stripe_payment_status already exists';
  END;

  -- Add user_id
  BEGIN
    ALTER TABLE public.pedidos_delivery ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'Column user_id already exists';
  END;

  -- Add endereco_id
  BEGIN
    ALTER TABLE public.pedidos_delivery ADD COLUMN endereco_id UUID REFERENCES public.enderecos_cliente(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'Column endereco_id already exists';
  END;

  -- Add agendado_para
  BEGIN
    ALTER TABLE public.pedidos_delivery ADD COLUMN agendado_para TIMESTAMPTZ;
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'Column agendado_para already exists';
  END;

  -- Add cupom_id
  BEGIN
    ALTER TABLE public.pedidos_delivery ADD COLUMN cupom_id UUID;
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'Column cupom_id already exists';
  END;

  -- Add troco_para
  BEGIN
    ALTER TABLE public.pedidos_delivery ADD COLUMN troco_para DECIMAL(10,2);
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'Column troco_para already exists';
  END;
END $$;

-- ============================================
-- PART 2: Create itens_delivery table
-- ============================================

CREATE TABLE IF NOT EXISTS public.itens_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_delivery_id UUID NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome_produto TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 3: Enable RLS
-- ============================================

ALTER TABLE public.pedidos_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_delivery ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 4: Drop ALL policies safely (ignoring errors)
-- ============================================

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
END $$;

-- ============================================
-- PART 5: Create new policies for pedidos_delivery
-- ============================================

CREATE POLICY "users_view_own_delivery_orders"
  ON public.pedidos_delivery FOR SELECT
  USING (
    auth.uid() = user_id 
    OR stripe_payment_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.empresa_id = pedidos_delivery.empresa_id
    )
  );

CREATE POLICY "staff_manage_delivery_orders"
  ON public.pedidos_delivery FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.empresa_id = pedidos_delivery.empresa_id
    )
  );

CREATE POLICY "anon_insert_delivery_orders" 
  ON public.pedidos_delivery 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

-- ============================================
-- PART 6: Create new policies for itens_delivery
-- ============================================

CREATE POLICY "users_view_delivery_items"
  ON public.itens_delivery FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_delivery pd
      WHERE pd.id = itens_delivery.pedido_delivery_id
      AND (
        pd.user_id = auth.uid() 
        OR pd.stripe_payment_id IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
          AND ur.empresa_id = pd.empresa_id
        )
      )
    )
  );

CREATE POLICY "anon_insert_delivery_items" 
  ON public.itens_delivery 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "staff_manage_delivery_items"
  ON public.itens_delivery 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_delivery pd
      JOIN user_roles ur ON ur.empresa_id = pd.empresa_id
      WHERE pd.id = itens_delivery.pedido_delivery_id
      AND ur.user_id = auth.uid()
    )
  );

-- ============================================
-- PART 7: Create indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_itens_delivery_pedido_id ON public.itens_delivery(pedido_delivery_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_user_id ON public.pedidos_delivery(user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_empresa_id ON public.pedidos_delivery(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_status ON public.pedidos_delivery(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_stripe_payment ON public.pedidos_delivery(stripe_payment_id);

-- ============================================
-- PART 8: Add/Update foreign key constraint
-- ============================================

DO $$
BEGIN
    BEGIN
        ALTER TABLE public.itens_delivery 
          DROP CONSTRAINT IF EXISTS itens_delivery_pedido_delivery_id_fkey;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop constraint: %', SQLERRM;
    END;
END $$;

ALTER TABLE public.itens_delivery 
  ADD CONSTRAINT itens_delivery_pedido_delivery_id_fkey 
  FOREIGN KEY (pedido_delivery_id) 
  REFERENCES public.pedidos_delivery(id) 
  ON DELETE CASCADE;

-- ============================================
-- PART 9: Add comments
-- ============================================

COMMENT ON TABLE public.pedidos_delivery IS 'Pedidos de delivery realizados pelos clientes';
COMMENT ON TABLE public.itens_delivery IS 'Itens individuais de cada pedido de delivery';
COMMENT ON CONSTRAINT itens_delivery_pedido_delivery_id_fkey ON public.itens_delivery IS 'Relacionamento entre itens e pedidos de delivery';
