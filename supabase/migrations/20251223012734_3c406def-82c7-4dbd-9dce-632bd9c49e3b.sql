-- Drop existing insert policy and recreate with correct permissions
DROP POLICY IF EXISTS "Public can create enderecos" ON public.enderecos_cliente;

-- Create policy that allows anyone to insert addresses (for delivery orders)
CREATE POLICY "Anyone can create delivery address" 
ON public.enderecos_cliente 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also allow public role for pedidos_delivery insert
DROP POLICY IF EXISTS "Public can create delivery orders" ON public.pedidos_delivery;

CREATE POLICY "Anyone can create delivery orders" 
ON public.pedidos_delivery 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Allow public to insert delivery items
DROP POLICY IF EXISTS "Public can create delivery items" ON public.itens_delivery;

CREATE POLICY "Anyone can create delivery items" 
ON public.itens_delivery 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);