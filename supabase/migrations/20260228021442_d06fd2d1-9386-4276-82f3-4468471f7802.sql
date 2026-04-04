-- Allow super admins to SELECT config_fiscal for any empresa
CREATE POLICY "Super admins can view all config_fiscal"
ON public.config_fiscal
FOR SELECT
USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND ativo = true));

-- Allow super admins to INSERT/UPDATE/DELETE config_fiscal for any empresa
CREATE POLICY "Super admins can manage all config_fiscal"
ON public.config_fiscal
FOR ALL
USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND ativo = true))
WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND ativo = true));