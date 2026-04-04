-- Dropar políticas existentes e recriar com role correto (anon) para INSERT público

-- ========== ENDERECOS_CLIENTE ==========
DROP POLICY IF EXISTS "Anyone can create delivery address" ON public.enderecos_cliente;

CREATE POLICY "Anyone can create delivery address" 
ON public.enderecos_cliente 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- ========== PEDIDOS_DELIVERY ==========
DROP POLICY IF EXISTS "Anyone can create delivery orders" ON public.pedidos_delivery;

CREATE POLICY "Anyone can create delivery orders" 
ON public.pedidos_delivery 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- ========== ITENS_DELIVERY ==========
DROP POLICY IF EXISTS "Anyone can create delivery items" ON public.itens_delivery;

CREATE POLICY "Anyone can create delivery items" 
ON public.itens_delivery 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);