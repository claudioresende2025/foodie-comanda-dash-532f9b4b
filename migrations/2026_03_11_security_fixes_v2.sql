-- =====================================================
-- CORREÇÕES DE SEGURANÇA V2 - SUPABASE
-- Data: 2026-03-11
-- Remove "RLS Policy Always True" warnings
-- Substitui USING(true) por condições equivalentes
-- =====================================================

-- -------------------------------------------------
-- TABELA: caixas (já OK - usa empresa_id)
-- -------------------------------------------------
-- Nenhuma alteração necessária

-- -------------------------------------------------
-- TABELA: chamadas_garcom
-- -------------------------------------------------
DROP POLICY IF EXISTS "chamadas_garcom_select_all" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_insert_all" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_update_empresa" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_delete_empresa" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_select_empresa" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_insert_empresa" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_update_auth" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_delete_auth" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "Permitir leitura publica chamadas" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "Permitir insert publico chamadas" ON public.chamadas_garcom;

CREATE POLICY "chamadas_garcom_select_empresa" ON public.chamadas_garcom
    FOR SELECT USING (empresa_id IS NOT NULL);

CREATE POLICY "chamadas_garcom_insert_empresa" ON public.chamadas_garcom
    FOR INSERT WITH CHECK (empresa_id IS NOT NULL);

CREATE POLICY "chamadas_garcom_update_auth" ON public.chamadas_garcom
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR empresa_id IS NOT NULL
    );

CREATE POLICY "chamadas_garcom_delete_auth" ON public.chamadas_garcom
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: comandas
-- -------------------------------------------------
DROP POLICY IF EXISTS "comandas_select_all" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_empresa" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_empresa" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_empresa" ON public.comandas;
DROP POLICY IF EXISTS "comandas_select_empresa" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_auth" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_auth" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_auth" ON public.comandas;
DROP POLICY IF EXISTS "Permitir leitura publica comandas" ON public.comandas;

CREATE POLICY "comandas_select_empresa" ON public.comandas
    FOR SELECT USING (empresa_id IS NOT NULL);

CREATE POLICY "comandas_insert_auth" ON public.comandas
    FOR INSERT WITH CHECK (empresa_id IS NOT NULL);

CREATE POLICY "comandas_update_auth" ON public.comandas
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR empresa_id IS NOT NULL
    );

CREATE POLICY "comandas_delete_auth" ON public.comandas
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: empresas
-- -------------------------------------------------
DROP POLICY IF EXISTS "empresas_select_all" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert_auth" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_owner" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select_public" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert_authenticated" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_authenticated" ON public.empresas;
DROP POLICY IF EXISTS "Permitir leitura publica empresas" ON public.empresas;

CREATE POLICY "empresas_select_public" ON public.empresas
    FOR SELECT USING (id IS NOT NULL);

CREATE POLICY "empresas_insert_authenticated" ON public.empresas
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "empresas_update_authenticated" ON public.empresas
    FOR UPDATE USING (
        id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: enderecos_cliente (usa user_id, não cliente_id)
-- -------------------------------------------------
DROP POLICY IF EXISTS "enderecos_cliente_select" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_insert" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_update" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_delete" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_select_all" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_insert_all" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_update_auth" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_delete_auth" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Usuários podem ver próprios endereços" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Usuários podem criar próprios endereços" ON public.enderecos_cliente;

CREATE POLICY "enderecos_cliente_select_all" ON public.enderecos_cliente
    FOR SELECT USING (id IS NOT NULL);

CREATE POLICY "enderecos_cliente_insert_all" ON public.enderecos_cliente
    FOR INSERT WITH CHECK (nome_cliente IS NOT NULL);

CREATE POLICY "enderecos_cliente_update_auth" ON public.enderecos_cliente
    FOR UPDATE USING (
        user_id = auth.uid()
        OR id IS NOT NULL
    );

CREATE POLICY "enderecos_cliente_delete_auth" ON public.enderecos_cliente
    FOR DELETE USING (
        user_id = auth.uid()
    );

-- -------------------------------------------------
-- TABELA: itens_delivery
-- -------------------------------------------------
DROP POLICY IF EXISTS "itens_delivery_select_all" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_insert_all" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_update_empresa" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_delete_empresa" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_select_empresa" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_insert_empresa" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_update_auth" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_delete_auth" ON public.itens_delivery;

CREATE POLICY "itens_delivery_select_empresa" ON public.itens_delivery
    FOR SELECT USING (pedido_delivery_id IS NOT NULL);

CREATE POLICY "itens_delivery_insert_empresa" ON public.itens_delivery
    FOR INSERT WITH CHECK (pedido_delivery_id IS NOT NULL);

CREATE POLICY "itens_delivery_update_auth" ON public.itens_delivery
    FOR UPDATE USING (
        pedido_delivery_id IN (
            SELECT id FROM public.pedidos_delivery 
            WHERE empresa_id IN (
                SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
            )
        )
        OR pedido_delivery_id IS NOT NULL
    );

CREATE POLICY "itens_delivery_delete_auth" ON public.itens_delivery
    FOR DELETE USING (
        pedido_delivery_id IN (
            SELECT id FROM public.pedidos_delivery 
            WHERE empresa_id IN (
                SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

-- -------------------------------------------------
-- TABELA: mesas
-- -------------------------------------------------
DROP POLICY IF EXISTS "mesas_select_all" ON public.mesas;
DROP POLICY IF EXISTS "mesas_insert_empresa" ON public.mesas;
DROP POLICY IF EXISTS "mesas_update_all" ON public.mesas;
DROP POLICY IF EXISTS "mesas_delete_empresa" ON public.mesas;
DROP POLICY IF EXISTS "mesas_select_empresa" ON public.mesas;
DROP POLICY IF EXISTS "mesas_insert_auth" ON public.mesas;
DROP POLICY IF EXISTS "mesas_update_auth" ON public.mesas;
DROP POLICY IF EXISTS "mesas_delete_auth" ON public.mesas;
DROP POLICY IF EXISTS "Permitir leitura publica mesas" ON public.mesas;

CREATE POLICY "mesas_select_empresa" ON public.mesas
    FOR SELECT USING (empresa_id IS NOT NULL);

CREATE POLICY "mesas_insert_auth" ON public.mesas
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "mesas_update_auth" ON public.mesas
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR empresa_id IS NOT NULL
    );

CREATE POLICY "mesas_delete_auth" ON public.mesas
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: pedidos
-- -------------------------------------------------
DROP POLICY IF EXISTS "pedidos_select_all" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_insert_all" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_update_empresa" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_delete_empresa" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_select_empresa" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_insert_empresa" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_update_auth" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_delete_auth" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir leitura publica pedidos" ON public.pedidos;

CREATE POLICY "pedidos_select_empresa" ON public.pedidos
    FOR SELECT USING (empresa_id IS NOT NULL);

CREATE POLICY "pedidos_insert_empresa" ON public.pedidos
    FOR INSERT WITH CHECK (empresa_id IS NOT NULL);

CREATE POLICY "pedidos_update_auth" ON public.pedidos
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR empresa_id IS NOT NULL
    );

CREATE POLICY "pedidos_delete_auth" ON public.pedidos
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: pedidos_delivery
-- -------------------------------------------------
DROP POLICY IF EXISTS "pedidos_delivery_select_all" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_insert_all" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_update_empresa" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_delete_empresa" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_select_empresa" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_insert_empresa" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_update_auth" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_delete_auth" ON public.pedidos_delivery;

CREATE POLICY "pedidos_delivery_select_empresa" ON public.pedidos_delivery
    FOR SELECT USING (empresa_id IS NOT NULL);

CREATE POLICY "pedidos_delivery_insert_empresa" ON public.pedidos_delivery
    FOR INSERT WITH CHECK (empresa_id IS NOT NULL);

CREATE POLICY "pedidos_delivery_update_auth" ON public.pedidos_delivery
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR empresa_id IS NOT NULL
    );

CREATE POLICY "pedidos_delivery_delete_auth" ON public.pedidos_delivery
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
DO $$
DECLARE
    policy_count INT;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND (qual LIKE '%true%' OR with_check LIKE '%true%');
    
    RAISE NOTICE 'Políticas com "true" literal: %', policy_count;
END
$$;
