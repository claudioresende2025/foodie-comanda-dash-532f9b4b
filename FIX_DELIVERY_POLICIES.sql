-- ===========================================
-- EXECUTE ESTE SQL NO SUPABASE DASHBOARD
-- (SQL Editor -> New Query)
-- ===========================================

-- PARTE 1: Limpar todas as políticas problemáticas
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'pedidos_delivery' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.pedidos_delivery';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'itens_delivery' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.itens_delivery';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'enderecos_cliente' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.enderecos_cliente';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'config_delivery' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.config_delivery';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'empresas' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.empresas';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'produtos' AND schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.produtos';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop policy %: %', r.policyname, SQLERRM;
        END;
    END LOOP;
END $$;

-- PARTE 2: Enable RLS
ALTER TABLE public.pedidos_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- PARTE 3: Políticas de empresas (PUBLIC READ)
CREATE POLICY "empresas_public_read"
  ON public.empresas FOR SELECT
  USING (true);

CREATE POLICY "empresas_owner_update"
  ON public.empresas FOR UPDATE
  USING (usuario_proprietario_id = auth.uid());

CREATE POLICY "empresas_owner_insert"
  ON public.empresas FOR INSERT
  WITH CHECK (auth.uid() = usuario_proprietario_id);

-- PARTE 4: Políticas de produtos (PUBLIC READ para ativos)
CREATE POLICY "produtos_public_read"
  ON public.produtos FOR SELECT
  USING (ativo = true);

CREATE POLICY "produtos_staff_all"
  ON public.produtos FOR ALL
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- PARTE 5: Políticas de config_delivery (PUBLIC READ para ativos)
CREATE POLICY "config_delivery_public_read"
  ON public.config_delivery FOR SELECT
  USING (ativo = true);

CREATE POLICY "config_delivery_staff_all"
  ON public.config_delivery FOR ALL
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- PARTE 6: Políticas de pedidos_delivery
-- Staff pode ver todos os pedidos de sua empresa
CREATE POLICY "pedidos_delivery_staff_read"
  ON public.pedidos_delivery FOR SELECT
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- Usuários podem ver seus próprios pedidos
CREATE POLICY "pedidos_delivery_user_read"
  ON public.pedidos_delivery FOR SELECT
  USING (auth.uid() = user_id);

-- Pedidos pagos pelo Stripe são visíveis (para a página de sucesso)
CREATE POLICY "pedidos_delivery_stripe_read"
  ON public.pedidos_delivery FOR SELECT
  USING (stripe_payment_id IS NOT NULL);

-- Insert permitido para autenticados
CREATE POLICY "pedidos_delivery_insert"
  ON public.pedidos_delivery FOR INSERT
  WITH CHECK (true);

-- Staff pode atualizar pedidos de sua empresa
CREATE POLICY "pedidos_delivery_staff_update"
  ON public.pedidos_delivery FOR UPDATE
  USING (
    empresa_id IN (
      SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- PARTE 7: Políticas de itens_delivery
CREATE POLICY "itens_delivery_public_read"
  ON public.itens_delivery FOR SELECT
  USING (true);

CREATE POLICY "itens_delivery_insert"
  ON public.itens_delivery FOR INSERT
  WITH CHECK (true);

-- PARTE 8: Políticas de enderecos_cliente
CREATE POLICY "enderecos_cliente_user_read"
  ON public.enderecos_cliente FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "enderecos_cliente_staff_read"
  ON public.enderecos_cliente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_delivery pd 
      WHERE pd.endereco_id = enderecos_cliente.id
      AND pd.empresa_id IN (
        SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()
      )
    )
  );

CREATE POLICY "enderecos_cliente_insert"
  ON public.enderecos_cliente FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "enderecos_cliente_update"
  ON public.enderecos_cliente FOR UPDATE
  USING (auth.uid() = user_id);

-- Confirmar resultado
SELECT 'Policies criadas com sucesso!' as status;
