-- Fix RLS policy for pedidos to allow public insert with proper check
DROP POLICY IF EXISTS "Public can create pedidos" ON public.pedidos;
CREATE POLICY "Public can create pedidos"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM comandas c
    WHERE c.id = comanda_id
    AND c.status = 'aberta'
  )
);

-- Also ensure comandas public insert is working correctly
DROP POLICY IF EXISTS "Public can create comandas for menu" ON public.comandas;
CREATE POLICY "Public can create comandas for menu"
ON public.comandas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow public to update their own comanda total
DROP POLICY IF EXISTS "Public can update comanda total" ON public.comandas;
CREATE POLICY "Public can update comanda total"
ON public.comandas
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Ensure enderecos_cliente allows public SELECT for tracking
DROP POLICY IF EXISTS "Public can view own address by delivery order" ON public.enderecos_cliente;
CREATE POLICY "Public can view own address by delivery order"
ON public.enderecos_cliente
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM pedidos_delivery pd
    WHERE pd.endereco_id = id
    AND pd.stripe_payment_id IS NOT NULL
  )
);