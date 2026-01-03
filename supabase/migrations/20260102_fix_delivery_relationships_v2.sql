-- Fix delivery relationships - V2 (Safe version)
-- This migration ensures proper relationship between pedidos_delivery and itens_delivery
-- Adds missing columns safely without dropping existing tables

-- Add missing columns to pedidos_delivery if they don't exist
DO $$ 
BEGIN
  -- Add stripe_payment_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'stripe_payment_id') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN stripe_payment_id TEXT;
  END IF;

  -- Add stripe_payment_status if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'stripe_payment_status') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN stripe_payment_status TEXT;
  END IF;

  -- Add user_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'user_id') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add endereco_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'endereco_id') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN endereco_id UUID REFERENCES public.enderecos_cliente(id) ON DELETE SET NULL;
  END IF;

  -- Add agendado_para if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'agendado_para') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN agendado_para TIMESTAMPTZ;
  END IF;

  -- Add cupom_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'cupom_id') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN cupom_id UUID;
  END IF;

  -- Add troco_para if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'pedidos_delivery' 
                 AND column_name = 'troco_para') THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN troco_para DECIMAL(10,2);
  END IF;
END $$;

-- Ensure itens_delivery table exists with correct structure
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

-- Enable RLS
ALTER TABLE public.pedidos_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_delivery ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Usuários podem ver próprios pedidos delivery" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Public can view delivery by stripe session" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Staff can manage delivery orders" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Anyone can create delivery orders" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Allow anon insert pedidos_delivery" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Public can view own delivery order" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Allow authenticated insert pedidos_delivery" ON public.pedidos_delivery;

DROP POLICY IF EXISTS "Usuários podem ver itens dos seus pedidos" ON public.itens_delivery;
DROP POLICY IF EXISTS "Anyone can create delivery items" ON public.itens_delivery;
DROP POLICY IF EXISTS "Allow anon insert itens_delivery" ON public.itens_delivery;

-- Recreate policies for pedidos_delivery
CREATE POLICY "Usuários podem ver próprios pedidos delivery"
  ON public.pedidos_delivery FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view delivery by stripe session"
  ON public.pedidos_delivery FOR SELECT
  USING (stripe_payment_id IS NOT NULL);

CREATE POLICY "Staff can manage delivery orders"
  ON public.pedidos_delivery FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.empresa_id = pedidos_delivery.empresa_id
    )
  );

CREATE POLICY "Allow anon insert pedidos_delivery" 
  ON public.pedidos_delivery 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

-- Recreate policies for itens_delivery
CREATE POLICY "Usuários podem ver itens dos seus pedidos"
  ON public.itens_delivery FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_delivery pd
      WHERE pd.id = itens_delivery.pedido_delivery_id
      AND (pd.user_id = auth.uid() OR pd.stripe_payment_id IS NOT NULL)
    )
  );

CREATE POLICY "Allow anon insert itens_delivery" 
  ON public.itens_delivery 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_itens_delivery_pedido_id ON public.itens_delivery(pedido_delivery_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_user_id ON public.pedidos_delivery(user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_empresa_id ON public.pedidos_delivery(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_status ON public.pedidos_delivery(status);

-- Remove old constraint if exists
ALTER TABLE public.itens_delivery 
  DROP CONSTRAINT IF EXISTS itens_delivery_pedido_delivery_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE public.itens_delivery 
  ADD CONSTRAINT itens_delivery_pedido_delivery_id_fkey 
  FOREIGN KEY (pedido_delivery_id) 
  REFERENCES public.pedidos_delivery(id) 
  ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE public.pedidos_delivery IS 'Pedidos de delivery realizados pelos clientes';
COMMENT ON TABLE public.itens_delivery IS 'Itens individuais de cada pedido de delivery';
COMMENT ON CONSTRAINT itens_delivery_pedido_delivery_id_fkey ON public.itens_delivery IS 'Relacionamento entre itens e pedidos de delivery';
