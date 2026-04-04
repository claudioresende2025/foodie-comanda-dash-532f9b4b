-- Primeiro, dropar todas as políticas existentes da tabela enderecos_cliente
DROP POLICY IF EXISTS "Anyone can create delivery address" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Public can create enderecos" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Public can view own address by delivery order" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Staff can view delivery addresses" ON public.enderecos_cliente;

-- Recriar como PERMISSIVE (padrão) para INSERT
CREATE POLICY "Anyone can create delivery address" 
ON public.enderecos_cliente 
FOR INSERT 
TO public
WITH CHECK (true);

-- Recriar SELECT para staff
CREATE POLICY "Staff can view delivery addresses" 
ON public.enderecos_cliente 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM pedidos_delivery pd
  WHERE pd.endereco_id = enderecos_cliente.id 
  AND pd.empresa_id = get_user_empresa_id(auth.uid())
));

-- Dropar e recriar políticas do pedidos_delivery
DROP POLICY IF EXISTS "Anyone can create delivery orders" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Public can create delivery orders" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Public can view delivery by stripe session" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Staff can manage delivery orders" ON public.pedidos_delivery;

CREATE POLICY "Anyone can create delivery orders" 
ON public.pedidos_delivery 
FOR INSERT 
TO public
WITH CHECK (true);

CREATE POLICY "Public can view own delivery order" 
ON public.pedidos_delivery 
FOR SELECT 
TO public
USING (true);

CREATE POLICY "Staff can manage delivery orders" 
ON public.pedidos_delivery 
FOR ALL 
TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Dropar e recriar políticas do itens_delivery
DROP POLICY IF EXISTS "Anyone can create delivery items" ON public.itens_delivery;
DROP POLICY IF EXISTS "Public can create delivery items" ON public.itens_delivery;
DROP POLICY IF EXISTS "Public can view delivery items" ON public.itens_delivery;
DROP POLICY IF EXISTS "Staff can manage delivery items" ON public.itens_delivery;

CREATE POLICY "Anyone can create delivery items" 
ON public.itens_delivery 
FOR INSERT 
TO public
WITH CHECK (true);

CREATE POLICY "Public can view delivery items" 
ON public.itens_delivery 
FOR SELECT 
TO public
USING (true);

CREATE POLICY "Staff can manage delivery items" 
ON public.itens_delivery 
FOR ALL 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM pedidos_delivery pd
  WHERE pd.id = itens_delivery.pedido_delivery_id 
  AND pd.empresa_id = get_user_empresa_id(auth.uid())
));