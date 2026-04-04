-- Remover política atual que usa role 'public' (incorreto para Supabase)
DROP POLICY IF EXISTS "Allow public insert enderecos_cliente" ON public.enderecos_cliente;

-- Criar nova política para role 'anon' (role correta do Supabase)
CREATE POLICY "Allow anon insert enderecos_cliente" 
ON public.enderecos_cliente 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Fazer o mesmo para pedidos_delivery
DROP POLICY IF EXISTS "Allow public insert pedidos_delivery" ON public.pedidos_delivery;

CREATE POLICY "Allow anon insert pedidos_delivery" 
ON public.pedidos_delivery 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- E para itens_delivery
DROP POLICY IF EXISTS "Allow public insert itens_delivery" ON public.itens_delivery;

CREATE POLICY "Allow anon insert itens_delivery" 
ON public.itens_delivery 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);