-- Drop the existing restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Public can create enderecos" ON public.enderecos_cliente;

-- Create permissive policy for public INSERT
CREATE POLICY "Public can create enderecos" 
ON public.enderecos_cliente 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);