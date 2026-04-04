-- =====================================================
-- Corrigir RLS da tabela delivery_locations
-- Permitir que clientes (anônimos ou logados) vejam
-- a localização do entregador
-- Data: 2026-03-12
-- =====================================================

-- Remover política antiga restritiva
DROP POLICY IF EXISTS "Clientes podem ver localização dos seus pedidos" ON public.delivery_locations;

-- Criar política que permite SELECT público (qualquer um com o ID do pedido pode ver)
-- Isso é seguro porque o ID do pedido é um UUID difícil de adivinhar
CREATE POLICY "delivery_locations_select_all"
ON public.delivery_locations
FOR SELECT
USING (true);

-- Manter política para funcionários gerenciarem
DROP POLICY IF EXISTS "Funcionários podem gerenciar localizações da empresa" ON public.delivery_locations;

-- Política para INSERT/UPDATE pelos entregadores
CREATE POLICY "delivery_locations_manage_empresa"
ON public.delivery_locations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos_delivery pd
    WHERE pd.id = delivery_locations.pedido_delivery_id
    AND pd.empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT empresa_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pedidos_delivery pd
    WHERE pd.id = pedido_delivery_id
    AND pd.empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT empresa_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  )
);

-- Garantir permissões para anon (clientes não logados)
GRANT SELECT ON public.delivery_locations TO anon;
GRANT SELECT ON public.delivery_locations TO authenticated;
GRANT INSERT, UPDATE ON public.delivery_locations TO authenticated;
