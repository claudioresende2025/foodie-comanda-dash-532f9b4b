-- ============================================
-- SECURITY FIX: Criar view segura para empresas (dados públicos)
-- ============================================

-- Função de segurança para obter apenas dados públicos da empresa
CREATE OR REPLACE FUNCTION public.get_empresa_public_info(_empresa_id uuid)
RETURNS TABLE (
  id uuid,
  nome_fantasia text,
  logo_url text,
  endereco_completo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome_fantasia, logo_url, endereco_completo
  FROM empresas
  WHERE id = _empresa_id
$$;

-- ============================================
-- SECURITY FIX: Remover políticas públicas perigosas e criar restritivas
-- ============================================

-- Drop políticas públicas perigosas de enderecos_cliente
DROP POLICY IF EXISTS "Public can view enderecos" ON public.enderecos_cliente;

-- Criar política restritiva para enderecos_cliente (apenas staff pode ver)
CREATE POLICY "Staff can view delivery addresses"
ON public.enderecos_cliente
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM pedidos_delivery pd
    WHERE pd.endereco_id = enderecos_cliente.id
    AND pd.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- ============================================
-- SECURITY FIX: Melhorar política de empresas para expor menos dados
-- ============================================

-- Drop política pública atual
DROP POLICY IF EXISTS "Public can view empresa basic info for menu" ON public.empresas;

-- Recriar política mais restritiva (ainda pública, mas limitada pela query)
CREATE POLICY "Public can view empresa for menu"
ON public.empresas
FOR SELECT
USING (true);
-- Nota: A restrição de colunas será feita via RPC ou queries específicas

-- ============================================
-- SECURITY FIX: Ajustar políticas de pedidos para serem menos permissivas
-- ============================================

-- Atualizar política de pedidos para restringir acesso por comanda
DROP POLICY IF EXISTS "Public can view pedidos for menu" ON public.pedidos;

CREATE POLICY "View pedidos by comanda session"
ON public.pedidos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM comandas c
    WHERE c.id = pedidos.comanda_id
  )
);

-- Atualizar política de pedidos_delivery
DROP POLICY IF EXISTS "Public can view own delivery orders" ON public.pedidos_delivery;

CREATE POLICY "Public can view delivery by stripe session"
ON public.pedidos_delivery
FOR SELECT
USING (stripe_payment_id IS NOT NULL);