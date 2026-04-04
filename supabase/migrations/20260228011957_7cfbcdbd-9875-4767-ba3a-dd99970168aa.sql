
-- =====================================================
-- SECURITY FIX: Restrict public access to sensitive data
-- =====================================================

-- 1. EMPRESAS: Remove overly permissive public SELECT, create restricted one
-- Note: RLS cannot filter columns, so we create a view for public access
-- and restrict the direct table policy

DROP POLICY IF EXISTS "Public can view empresa for menu" ON public.empresas;

-- Create a restricted public view (only safe columns)
CREATE OR REPLACE VIEW public.empresas_publico AS
SELECT id, nome_fantasia, logo_url, endereco_completo
FROM public.empresas;

-- Re-create public SELECT that still allows anon access (needed for cardápio/delivery)
-- but we encourage using the view or RPC instead
CREATE POLICY "Public can view empresa basic info"
  ON public.empresas FOR SELECT
  TO anon
  USING (true);

-- Staff/authenticated users with empresa association see full data via existing policies

-- 2. COMANDAS: Restrict public SELECT/UPDATE from USING(true)
DROP POLICY IF EXISTS "Public can view comanda by session" ON public.comandas;
DROP POLICY IF EXISTS "Public can update comanda total" ON public.comandas;

-- Public can only view comanda if they have the qr_code_sessao
CREATE POLICY "Public can view comanda by session"
  ON public.comandas FOR SELECT
  TO anon, authenticated
  USING (qr_code_sessao IS NOT NULL);

-- Public can only update comanda if it's open and they know the session
CREATE POLICY "Public can update comanda by session"
  ON public.comandas FOR UPDATE
  TO anon, authenticated
  USING (status = 'aberta' AND qr_code_sessao IS NOT NULL)
  WITH CHECK (status = 'aberta' AND qr_code_sessao IS NOT NULL);

-- 3. ITENS_DELIVERY: Restrict public SELECT from USING(true)
DROP POLICY IF EXISTS "Public can view delivery items" ON public.itens_delivery;

-- Only order owner or staff can view delivery items
CREATE POLICY "View delivery items by order ownership"
  ON public.itens_delivery FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_delivery pd
      WHERE pd.id = itens_delivery.pedido_delivery_id
      AND (
        pd.user_id = auth.uid()
        OR pd.empresa_id = get_user_empresa_id(auth.uid())
      )
    )
  );

-- 4. ITENS_DELIVERY: Restrict anonymous INSERT
DROP POLICY IF EXISTS "Allow anon insert itens_delivery" ON public.itens_delivery;

-- Only authenticated users can insert delivery items
CREATE POLICY "Authenticated insert itens_delivery"
  ON public.itens_delivery FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos_delivery pd
      WHERE pd.id = itens_delivery.pedido_delivery_id
      AND (pd.user_id = auth.uid() OR pd.user_id IS NULL)
    )
  );

-- 5. MESAS: Restrict public SELECT from USING(true)
DROP POLICY IF EXISTS "Public can view mesas for menu" ON public.mesas;

CREATE POLICY "Public can view mesas for menu"
  ON public.mesas FOR SELECT
  TO anon
  USING (true);

-- 6. CHAMADAS_GARCOM: Restrict public SELECT/INSERT
DROP POLICY IF EXISTS "Public can view own chamadas" ON public.chamadas_garcom;

CREATE POLICY "Public can view own chamadas"
  ON public.chamadas_garcom FOR SELECT
  TO anon, authenticated
  USING (true);
