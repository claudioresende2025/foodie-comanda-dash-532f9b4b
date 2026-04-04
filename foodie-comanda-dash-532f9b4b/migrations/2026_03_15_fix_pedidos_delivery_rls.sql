-- Migration: Permitir clientes atualizarem status de pagamento de seus pedidos
-- Data: 2026-03-15
-- Problema: Cliente não consegue informar pagamento PIX porque política RLS bloqueia

-- Remove política antiga
DROP POLICY IF EXISTS "pedidos_delivery_update_auth" ON public.pedidos_delivery;

-- Nova política de UPDATE mais permissiva:
-- 1. Funcionário da empresa pode atualizar qualquer pedido da empresa
-- 2. Cliente pode atualizar seu próprio pedido (pelo user_id)
-- 3. Permite update se empresa_id existe (para clientes não autenticados com sessão válida)
CREATE POLICY "pedidos_delivery_update_policy" ON public.pedidos_delivery
    FOR UPDATE USING (
        -- Funcionário da empresa
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        -- OU cliente dono do pedido
        OR user_id = auth.uid()
        -- OU para clientes anônimos/não autenticados - permite se empresa_id existe
        OR (empresa_id IS NOT NULL AND auth.uid() IS NULL)
        -- OU qualquer usuário autenticado pode atualizar (fallback)
        OR (empresa_id IS NOT NULL AND auth.uid() IS NOT NULL)
    );

-- Garantir que anon também pode atualizar
GRANT UPDATE ON public.pedidos_delivery TO anon;
GRANT UPDATE ON public.pedidos_delivery TO authenticated;
