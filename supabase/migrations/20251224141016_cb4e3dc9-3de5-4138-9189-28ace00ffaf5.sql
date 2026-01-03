-- Corrigir políticas RLS para permitir inserções anônimas no delivery

-- 1. Dropar políticas RESTRICTIVE de INSERT
DROP POLICY IF EXISTS "Allow anon insert enderecos_cliente" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Allow anon insert pedidos_delivery" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "Allow anon insert itens_delivery" ON public.itens_delivery;

-- 2. Recriar políticas como PERMISSIVE (padrão)
CREATE POLICY "Allow anon insert enderecos_cliente" 
ON public.enderecos_cliente 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anon insert pedidos_delivery" 
ON public.pedidos_delivery 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anon insert itens_delivery" 
ON public.itens_delivery 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- 3. Adicionar política SELECT para enderecos_cliente (necessária para o fluxo)
DROP POLICY IF EXISTS "Public can view own address" ON public.enderecos_cliente;
CREATE POLICY "Public can view own address" 
ON public.enderecos_cliente 
FOR SELECT 
TO anon, authenticated
USING (true);