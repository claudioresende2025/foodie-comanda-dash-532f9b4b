-- Allow anonymous users to read empresa info for delivery checkout
-- This is needed for the delivery page to display chave_pix

-- First, drop the restrictive authenticated-only policy if needed
DROP POLICY IF EXISTS "Ver empresas da própria empresa" ON public.empresas;

-- Create a new policy that allows authenticated users to access their own empresa
CREATE POLICY "Authenticated users can view their empresa"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  id = public.get_user_empresa_id(auth.uid())
  OR usuario_proprietario_id = auth.uid()
);

-- Create a public policy for delivery checkout - anyone can view basic empresa info including chave_pix
CREATE POLICY "Public can view empresa for delivery"
ON public.empresas
FOR SELECT
USING (true);
