-- Allow public read access to empresas for menu display (only basic info)
CREATE POLICY "Public can view empresa basic info for menu"
ON public.empresas
FOR SELECT
USING (true);

-- Allow public read access to categorias for menu display
CREATE POLICY "Public can view categorias for menu"
ON public.categorias
FOR SELECT
USING (ativo = true);

-- Allow public read access to produtos for menu display
CREATE POLICY "Public can view active produtos for menu"
ON public.produtos
FOR SELECT
USING (ativo = true);

-- Allow public read access to mesas for menu (to show mesa number)
CREATE POLICY "Public can view mesas for menu"
ON public.mesas
FOR SELECT
USING (true);