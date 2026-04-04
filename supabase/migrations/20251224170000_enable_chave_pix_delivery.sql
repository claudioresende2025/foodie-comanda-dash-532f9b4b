-- Allow public read access to chave_pix for delivery checkout
-- This policy allows anyone to read empresas to display delivery info including PIX key

CREATE POLICY "Public can view empresa for delivery checkout"
ON public.empresas
FOR SELECT
USING (true);
