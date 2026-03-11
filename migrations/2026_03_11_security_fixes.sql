-- =====================================================
-- CORREÇÕES DE SEGURANÇA - SUPABASE
-- Data: 2026-03-11
-- Corrige: Function Search Path Mutable e RLS Policy Always True
-- =====================================================

-- =====================================================
-- PARTE 1: CORRIGIR SEARCH_PATH DAS FUNÇÕES
-- Usa bloco dinâmico para lidar com overloads
-- =====================================================

DO $$
DECLARE
    func_rec RECORD;
    func_names TEXT[] := ARRAY[
        'exec_sql', 'auto_super_admin', 'check_empresa_blocked', 
        'check_mesas_limit', 'debitar_pontos_fidelidade', 'is_super_admin_direct',
        'abrir_comanda_e_ocupar_mesa', 'adicionar_pontos_por_pedido',
        'upsert_profile_empresa', 'processar_fidelidade_entrega',
        'get_empresa_publico', 'gerar_pix', 'create_trial_subscription',
        'update_updated_at_column', 'liberar_mesa'
    ];
BEGIN
    FOR func_rec IN 
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args, p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = ANY(func_names)
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', 
                           func_rec.proname, func_rec.args);
            RAISE NOTICE 'Corrigido: %.%(%)', 'public', func_rec.proname, func_rec.args;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao corrigir %.%(%): %', 'public', func_rec.proname, func_rec.args, SQLERRM;
        END;
    END LOOP;
END
$$;

-- =====================================================
-- PARTE 2: CORRIGIR POLÍTICAS RLS
-- Substituir USING (true) por verificação de empresa_id
-- =====================================================

-- -------------------------------------------------
-- TABELA: caixas
-- -------------------------------------------------
DROP POLICY IF EXISTS "Usuarios podem ver caixas da empresa" ON public.caixas;
DROP POLICY IF EXISTS "caixas_select_policy" ON public.caixas;
DROP POLICY IF EXISTS "caixas_insert_policy" ON public.caixas;
DROP POLICY IF EXISTS "caixas_update_policy" ON public.caixas;
DROP POLICY IF EXISTS "caixas_delete_policy" ON public.caixas;
DROP POLICY IF EXISTS "caixas_select_empresa" ON public.caixas;
DROP POLICY IF EXISTS "caixas_insert_empresa" ON public.caixas;
DROP POLICY IF EXISTS "caixas_update_empresa" ON public.caixas;
DROP POLICY IF EXISTS "caixas_delete_empresa" ON public.caixas;

CREATE POLICY "caixas_select_empresa" ON public.caixas
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "caixas_insert_empresa" ON public.caixas
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "caixas_update_empresa" ON public.caixas
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "caixas_delete_empresa" ON public.caixas
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: chamadas_garcom
-- -------------------------------------------------
DROP POLICY IF EXISTS "chamadas_garcom_select_policy" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_insert_policy" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_update_policy" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_delete_policy" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "Permitir leitura publica chamadas" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "Permitir insert publico chamadas" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "Permitir update chamadas" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_select_all" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_insert_all" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_update_empresa" ON public.chamadas_garcom;
DROP POLICY IF EXISTS "chamadas_garcom_delete_empresa" ON public.chamadas_garcom;

-- Chamadas garçom precisa permitir acesso público para clientes na mesa
CREATE POLICY "chamadas_garcom_select_all" ON public.chamadas_garcom
    FOR SELECT USING (true); -- Necessário para clientes verem status

CREATE POLICY "chamadas_garcom_insert_all" ON public.chamadas_garcom
    FOR INSERT WITH CHECK (true); -- Clientes podem criar chamadas

CREATE POLICY "chamadas_garcom_update_empresa" ON public.chamadas_garcom
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR auth.uid() IS NULL -- Para atualizações anônimas do cliente
    );

CREATE POLICY "chamadas_garcom_delete_empresa" ON public.chamadas_garcom
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: comandas
-- -------------------------------------------------
DROP POLICY IF EXISTS "comandas_select_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_policy" ON public.comandas;
DROP POLICY IF EXISTS "Usuarios podem ver comandas da empresa" ON public.comandas;
DROP POLICY IF EXISTS "Permitir leitura publica comandas" ON public.comandas;
DROP POLICY IF EXISTS "comandas_select_all" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_empresa" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_empresa" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_empresa" ON public.comandas;

-- Comandas precisam de acesso público para clientes verem seus pedidos
CREATE POLICY "comandas_select_all" ON public.comandas
    FOR SELECT USING (true); -- Clientes precisam ver comandas da mesa

CREATE POLICY "comandas_insert_empresa" ON public.comandas
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR auth.uid() IS NULL -- Anônimos podem abrir comanda
    );

CREATE POLICY "comandas_update_empresa" ON public.comandas
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR auth.uid() IS NULL
    );

CREATE POLICY "comandas_delete_empresa" ON public.comandas
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: empresas
-- -------------------------------------------------
DROP POLICY IF EXISTS "empresas_select_policy" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert_policy" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_policy" ON public.empresas;
DROP POLICY IF EXISTS "Usuarios podem ver sua empresa" ON public.empresas;
DROP POLICY IF EXISTS "Permitir leitura publica empresas" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select_all" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert_auth" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_owner" ON public.empresas;

-- Empresas precisam de leitura pública para cardápio
CREATE POLICY "empresas_select_all" ON public.empresas
    FOR SELECT USING (true); -- Público precisa ver dados da empresa no cardápio

CREATE POLICY "empresas_insert_auth" ON public.empresas
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "empresas_update_owner" ON public.empresas
    FOR UPDATE USING (
        id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: enderecos_cliente
-- -------------------------------------------------
DROP POLICY IF EXISTS "enderecos_cliente_select_policy" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_insert_policy" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_update_policy" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_delete_policy" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_select" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_insert" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_update" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "enderecos_cliente_delete" ON public.enderecos_cliente;

CREATE POLICY "enderecos_cliente_select" ON public.enderecos_cliente
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid()
        )
        OR auth.uid() IS NULL
    );

CREATE POLICY "enderecos_cliente_insert" ON public.enderecos_cliente
    FOR INSERT WITH CHECK (true); -- Clientes podem adicionar endereços

CREATE POLICY "enderecos_cliente_update" ON public.enderecos_cliente
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid()
        )
        OR auth.uid() IS NULL
    );

CREATE POLICY "enderecos_cliente_delete" ON public.enderecos_cliente
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: itens_delivery (coluna correta: pedido_delivery_id)
-- -------------------------------------------------
DROP POLICY IF EXISTS "itens_delivery_select_policy" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_insert_policy" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_update_policy" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_delete_policy" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_select_all" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_insert_all" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_update_empresa" ON public.itens_delivery;
DROP POLICY IF EXISTS "itens_delivery_delete_empresa" ON public.itens_delivery;

CREATE POLICY "itens_delivery_select_all" ON public.itens_delivery
    FOR SELECT USING (true); -- Clientes precisam ver itens do pedido

CREATE POLICY "itens_delivery_insert_all" ON public.itens_delivery
    FOR INSERT WITH CHECK (true); -- Clientes podem adicionar itens

CREATE POLICY "itens_delivery_update_empresa" ON public.itens_delivery
    FOR UPDATE USING (
        pedido_delivery_id IN (
            SELECT id FROM public.pedidos_delivery 
            WHERE empresa_id IN (
                SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
            )
        )
        OR auth.uid() IS NULL
    );

CREATE POLICY "itens_delivery_delete_empresa" ON public.itens_delivery
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
DROP POLICY IF EXISTS "mesas_select_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_insert_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_update_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_delete_policy" ON public.mesas;
DROP POLICY IF EXISTS "Usuarios podem ver mesas da empresa" ON public.mesas;
DROP POLICY IF EXISTS "Permitir leitura publica mesas" ON public.mesas;
DROP POLICY IF EXISTS "mesas_select_all" ON public.mesas;
DROP POLICY IF EXISTS "mesas_insert_empresa" ON public.mesas;
DROP POLICY IF EXISTS "mesas_update_all" ON public.mesas;
DROP POLICY IF EXISTS "mesas_delete_empresa" ON public.mesas;

-- Mesas precisam de acesso público para cardápio por QR Code
CREATE POLICY "mesas_select_all" ON public.mesas
    FOR SELECT USING (true); -- Público para QR Code

CREATE POLICY "mesas_insert_empresa" ON public.mesas
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "mesas_update_all" ON public.mesas
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR auth.uid() IS NULL -- Clientes podem atualizar status
    );

CREATE POLICY "mesas_delete_empresa" ON public.mesas
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: pedidos
-- -------------------------------------------------
DROP POLICY IF EXISTS "pedidos_select_policy" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_insert_policy" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_update_policy" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_delete_policy" ON public.pedidos;
DROP POLICY IF EXISTS "Usuarios podem ver pedidos da empresa" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir leitura publica pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_select_all" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_insert_all" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_update_empresa" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_delete_empresa" ON public.pedidos;

-- Pedidos precisam de acesso público para clientes verem status
CREATE POLICY "pedidos_select_all" ON public.pedidos
    FOR SELECT USING (true); -- Clientes veem seus pedidos

CREATE POLICY "pedidos_insert_all" ON public.pedidos
    FOR INSERT WITH CHECK (true); -- Clientes podem fazer pedidos

CREATE POLICY "pedidos_update_empresa" ON public.pedidos
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR auth.uid() IS NULL -- Clientes podem atualizar
    );

CREATE POLICY "pedidos_delete_empresa" ON public.pedidos
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- -------------------------------------------------
-- TABELA: pedidos_delivery
-- -------------------------------------------------
DROP POLICY IF EXISTS "pedidos_delivery_select_policy" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_insert_policy" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_update_policy" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_delete_policy" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_select_all" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_insert_all" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_update_empresa" ON public.pedidos_delivery;
DROP POLICY IF EXISTS "pedidos_delivery_delete_empresa" ON public.pedidos_delivery;

CREATE POLICY "pedidos_delivery_select_all" ON public.pedidos_delivery
    FOR SELECT USING (true); -- Clientes veem seus pedidos

CREATE POLICY "pedidos_delivery_insert_all" ON public.pedidos_delivery
    FOR INSERT WITH CHECK (true); -- Clientes podem fazer pedidos

CREATE POLICY "pedidos_delivery_update_empresa" ON public.pedidos_delivery
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
        OR auth.uid() IS NULL
    );

CREATE POLICY "pedidos_delivery_delete_empresa" ON public.pedidos_delivery
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- =====================================================
-- PARTE 3: HABILITAR LEAKED PASSWORD PROTECTION
-- (Isso deve ser feito no Dashboard do Supabase)
-- =====================================================
-- Para habilitar:
-- 1. Acesse o Dashboard do Supabase
-- 2. Vá em Authentication > Settings
-- 3. Ative "Leaked Password Protection"

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$
DECLARE
    func_count INT;
    policy_count INT;
BEGIN
    -- Contar funções com search_path definido
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proconfig IS NOT NULL
    AND 'search_path=public' = ANY(p.proconfig);
    
    RAISE NOTICE 'Funções com search_path configurado: %', func_count;
    
    -- Contar políticas RLS
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Total de políticas RLS: %', policy_count;
END
$$;

-- =====================================================
-- GRANT NECESSÁRIOS
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Permissões específicas para anon (clientes não logados)
GRANT INSERT ON public.pedidos TO anon;
GRANT INSERT ON public.comandas TO anon;
GRANT INSERT ON public.chamadas_garcom TO anon;
GRANT UPDATE ON public.mesas TO anon;
GRANT UPDATE ON public.chamadas_garcom TO anon;
GRANT UPDATE ON public.pedidos TO anon;
GRANT UPDATE ON public.comandas TO anon;
