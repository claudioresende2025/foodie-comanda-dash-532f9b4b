-- ===========================================
-- FIX FINAL: Correção RLS da tabela pedidos
-- ===========================================
-- Este script corrige o erro de RLS que impede
-- clientes de fazerem pedidos no restaurante
-- ===========================================

-- Remove TODAS as policies existentes da tabela pedidos
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'pedidos' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.pedidos';
            RAISE NOTICE 'Policy removida: %', r.policyname;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Erro ao remover policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Garante que RLS está habilitado
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT - permite que todos vejam pedidos
-- Necessário para: KDS, garçom, clientes verem status
CREATE POLICY "pedidos_select_policy"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy para INSERT - permite criar pedidos de forma permissiva
-- A validação da comanda será feita no código da aplicação
CREATE POLICY "pedidos_insert_policy"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy para UPDATE - permite atualizar pedidos
-- Necessário para: KDS mudar status, atualizar observações
CREATE POLICY "pedidos_update_policy"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Policy para DELETE - permite deletar pedidos
-- Necessário para: cancelamentos
CREATE POLICY "pedidos_delete_policy"
ON public.pedidos
FOR DELETE
TO anon, authenticated
USING (true);

-- ===========================================
-- COMANDAS: Também corrige policies
-- ===========================================

-- Remove TODAS as policies existentes da tabela comandas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'comandas' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.comandas';
            RAISE NOTICE 'Policy de comandas removida: %', r.policyname;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Erro ao remover policy de comandas %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Garante que RLS está habilitado para comandas
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT comandas
CREATE POLICY "comandas_select_policy"
ON public.comandas
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy para INSERT comandas
CREATE POLICY "comandas_insert_policy"
ON public.comandas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy para UPDATE comandas
CREATE POLICY "comandas_update_policy"
ON public.comandas
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Policy para DELETE comandas
CREATE POLICY "comandas_delete_policy"
ON public.comandas
FOR DELETE
TO anon, authenticated
USING (true);

-- ===========================================
-- Verifica as policies criadas
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE '=== Policies da tabela pedidos ===';
END $$;

SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'pedidos' AND schemaname = 'public';

DO $$
BEGIN
    RAISE NOTICE '=== Policies da tabela comandas ===';
END $$;

SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'comandas' AND schemaname = 'public';
