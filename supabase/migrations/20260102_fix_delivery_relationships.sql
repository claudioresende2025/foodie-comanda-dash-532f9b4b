-- Fix delivery relationships and ensure proper schema
-- This migration ensures proper relationship between pedidos_delivery and itens_delivery

-- Drop existing tables if they exist with wrong names
DROP TABLE IF EXISTS public.items_delivery CASCADE;

-- Ensure the correct tables exist with proper relationships
CREATE TABLE IF NOT EXISTS public.pedidos_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endereco_id UUID REFERENCES public.enderecos_cliente(id) ON DELETE SET NULL,
  subtotal DECIMAL(10,2) DEFAULT 0,
  taxa_entrega DECIMAL(10,2) DEFAULT 0,
  desconto DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pendente',
  forma_pagamento TEXT,
  notas TEXT,
  agendado_para TIMESTAMPTZ,
  cupom_id UUID,
  troco_para DECIMAL(10,2),
  stripe_payment_id TEXT,
  stripe_payment_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.itens_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
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

-- Add foreign key name for better Supabase integration
ALTER TABLE public.itens_delivery 
  DROP CONSTRAINT IF EXISTS itens_delivery_pedido_delivery_id_fkey;

ALTER TABLE public.itens_delivery 
  ADD CONSTRAINT itens_delivery_pedido_delivery_id_fkey 
  FOREIGN KEY (pedido_delivery_id) 
  REFERENCES public.pedidos_delivery(id) 
  ON DELETE CASCADE;

COMMENT ON TABLE public.pedidos_delivery IS 'Pedidos de delivery realizados pelos clientes';
COMMENT ON TABLE public.itens_delivery IS 'Itens individuais de cada pedido de delivery';
COMMENT ON CONSTRAINT itens_delivery_pedido_delivery_id_fkey ON public.itens_delivery IS 'Relacionamento entre itens e pedidos de delivery';
