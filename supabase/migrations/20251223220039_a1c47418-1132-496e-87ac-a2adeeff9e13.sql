-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Allow anon insert enderecos_cliente" ON public.enderecos_cliente;

CREATE POLICY "Allow anon insert enderecos_cliente"
ON public.enderecos_cliente
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also fix pedidos_delivery insert policy
DROP POLICY IF EXISTS "Allow anon insert pedidos_delivery" ON public.pedidos_delivery;

CREATE POLICY "Allow anon insert pedidos_delivery"
ON public.pedidos_delivery
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also fix itens_delivery insert policy
DROP POLICY IF EXISTS "Allow anon insert itens_delivery" ON public.itens_delivery;

CREATE POLICY "Allow anon insert itens_delivery"
ON public.itens_delivery
FOR INSERT
TO anon, authenticated
WITH CHECK (true);