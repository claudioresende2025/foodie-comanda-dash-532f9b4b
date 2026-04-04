
-- Fix SECURITY DEFINER view - make it SECURITY INVOKER
CREATE OR REPLACE VIEW public.empresas_publico
WITH (security_invoker = true) AS
SELECT id, nome_fantasia, logo_url, endereco_completo
FROM public.empresas;

-- Fix remaining permissive WITH CHECK(true) policies

-- COMANDAS: "Public can create comandas for menu" uses WITH CHECK(true)
DROP POLICY IF EXISTS "Public can create comandas for menu" ON public.comandas;
CREATE POLICY "Public can create comandas for menu"
  ON public.comandas FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'aberta' AND mesa_id IS NOT NULL);

-- CHAMADAS_GARCOM: "Public can create chamadas" uses WITH CHECK(true)
DROP POLICY IF EXISTS "Public can create chamadas" ON public.chamadas_garcom;
CREATE POLICY "Public can create chamadas"
  ON public.chamadas_garcom FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pendente' AND mesa_id IS NOT NULL);

-- ASSINATURAS: "Service role pode gerenciar assinaturas" - this is for service role only, acceptable
-- EMPRESA_OVERRIDES: "Service role pode gerenciar overrides" - same, service role only
-- WEBHOOK_LOGS: "Service role full access" - same
-- INDICACOES: "Service role full access indicacoes" - same
-- These are intentional for edge functions using service role key
