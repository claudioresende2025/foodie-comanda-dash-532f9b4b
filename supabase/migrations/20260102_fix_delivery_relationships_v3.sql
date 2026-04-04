-- Fix delivery relationships - V3 (Ultimate Safe version)
-- This migration ensures proper relationship between pedidos_delivery and itens_delivery
-- Fixes all issues step by step

-- STEP 1: Add missing columns to pedidos_delivery
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'stripe_payment_id') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN stripe_payment_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'stripe_payment_status') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN stripe_payment_status TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'user_id') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'endereco_id') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN endereco_id UUID REFERENCES public.enderecos_cliente(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'agendado_para') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN agendado_para TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'cupom_id') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN cupom_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'troco_para') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN troco_para DECIMAL(10,2);
  END IF;
END $$;

-- STEP 2: Create itens_delivery table if not exists
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

-- STEP 3: Enable RLS
ALTER TABLE public.pedidos_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_delivery ENABLE ROW LEVEL SECURITY;

-- STEP 4: Drop ALL existing policies (cleanup)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies from pedidos_delivery
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'pedidos_delivery' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.pedidos_delivery';
    END LOOP;
    
    -- Drop all policies from itens_delivery
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'itens_delivery' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.itens_delivery';
    END LOOP;
END $$;

-- STEP 5: Create new policies for pedidos_delivery
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

-- STEP 6: Create new policies for itens_delivery
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

-- STEP 7: Create indexes
CREATE INDEX IF NOT EXISTS idx_itens_delivery_pedido_id ON public.itens_delivery(pedido_delivery_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_user_id ON public.pedidos_delivery(user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_empresa_id ON public.pedidos_delivery(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_status ON public.pedidos_delivery(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_stripe_payment ON public.pedidos_delivery(stripe_payment_id);

-- STEP 8: Add/Update foreign key constraint
ALTER TABLE public.itens_delivery 
  DROP CONSTRAINT IF EXISTS itens_delivery_pedido_delivery_id_fkey;

ALTER TABLE public.itens_delivery 
  ADD CONSTRAINT itens_delivery_pedido_delivery_id_fkey 
  FOREIGN KEY (pedido_delivery_id) 
  REFERENCES public.pedidos_delivery(id) 
  ON DELETE CASCADE;

-- STEP 9: Add comments
COMMENT ON TABLE public.pedidos_delivery IS 'Pedidos de delivery realizados pelos clientes';
COMMENT ON TABLE public.itens_delivery IS 'Itens individuais de cada pedido de delivery';
COMMENT ON CONSTRAINT itens_delivery_pedido_delivery_id_fkey ON public.itens_delivery IS 'Relacionamento entre itens e pedidos de delivery';
