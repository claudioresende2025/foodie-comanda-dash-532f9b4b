-- Remover TODAS as políticas INSERT existentes e recriar com permissão explícita

-- ENDERECOS_CLIENTE
DROP POLICY IF EXISTS "Anyone can create delivery address" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Public can insert enderecos" ON public.enderecos_cliente;

-- Criar nova política com permissão pública total (sem roles)
CREATE POLICY "Allow public insert enderecos_cliente" 
ON public.enderecos_cliente 
FOR INSERT 
WITH CHECK (true);

-- PEDIDOS_DELIVERY  
DROP POLICY IF EXISTS "Anyone can create delivery orders" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Public can insert delivery orders" ON public.pedidos_delivery;

CREATE POLICY "Allow public insert pedidos_delivery" 
ON public.pedidos_delivery 
FOR INSERT 
WITH CHECK (true);

-- ITENS_DELIVERY
DROP POLICY IF EXISTS "Anyone can create delivery items" ON public.itens_delivery;
DROP POLICY IF EXISTS "Public can insert delivery items" ON public.itens_delivery;

CREATE POLICY "Allow public insert itens_delivery" 
ON public.itens_delivery 
FOR INSERT 
WITH CHECK (true);