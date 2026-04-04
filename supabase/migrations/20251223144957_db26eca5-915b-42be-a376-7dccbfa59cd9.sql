-- Corrigir política SELECT de itens_delivery para usar anon
DROP POLICY IF EXISTS "Public can view delivery items" ON public.itens_delivery;
CREATE POLICY "Public can view delivery items"
ON public.itens_delivery
FOR SELECT
TO anon, authenticated
USING (true);

-- Corrigir política SELECT de pedidos_delivery para usar anon  
DROP POLICY IF EXISTS "Public can view own delivery order" ON public.pedidos_delivery;
CREATE POLICY "Public can view own delivery order"
ON public.pedidos_delivery
FOR SELECT
TO anon, authenticated
USING (true);