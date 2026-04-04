-- Fix RLS policies para tabela pedidos
-- Permite que usuários anônimos e autenticados possam criar pedidos

-- Remove policies existentes para evitar conflitos
DROP POLICY IF EXISTS "Public can create pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Public can view pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Public can update pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Pedidos são visíveis para todos" ON public.pedidos;
DROP POLICY IF EXISTS "Pedidos podem ser criados por todos" ON public.pedidos;
DROP POLICY IF EXISTS "Pedidos podem ser atualizados por todos" ON public.pedidos;
DROP POLICY IF EXISTS "Staff can manage pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Allow all pedidos operations" ON public.pedidos;

-- Habilita RLS se não estiver habilitado
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT - permite que todos vejam pedidos (necessário para KDS e clientes)
CREATE POLICY "pedidos_select_all"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy para INSERT - permite criar pedidos se a comanda existir e estiver aberta
CREATE POLICY "pedidos_insert_all"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM comandas c
    WHERE c.id = comanda_id
    AND c.status = 'aberta'
  )
);

-- Policy para UPDATE - permite atualizar pedidos (necessário para KDS mudar status)
CREATE POLICY "pedidos_update_all"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Policy para DELETE - permite deletar pedidos (cancelamentos)
CREATE POLICY "pedidos_delete_all"
ON public.pedidos
FOR DELETE
TO anon, authenticated
USING (true);

-- Garante que comandas também tem policies corretas
DROP POLICY IF EXISTS "Public can create comandas for menu" ON public.comandas;
DROP POLICY IF EXISTS "Public can view comandas" ON public.comandas;
DROP POLICY IF EXISTS "Public can update comanda total" ON public.comandas;
DROP POLICY IF EXISTS "comandas_select_all" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_all" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_all" ON public.comandas;

-- Habilita RLS para comandas
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT comandas
CREATE POLICY "comandas_select_all"
ON public.comandas
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy para INSERT comandas
CREATE POLICY "comandas_insert_all"
ON public.comandas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy para UPDATE comandas
CREATE POLICY "comandas_update_all"
ON public.comandas
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
