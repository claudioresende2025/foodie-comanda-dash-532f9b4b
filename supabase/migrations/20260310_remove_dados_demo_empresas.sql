-- ============================================================================
-- MIGRATION: Remover dados demo e desativar criação automática
-- Data: 2026-03-10
-- Descrição: 
--   1. Deleta todas as mesas de todas as empresas
--   2. Deleta todos os produtos de todas as empresas
--   3. Deleta todas as categorias de todas as empresas
--   4. Remove o trigger de criação automática de dados demo
--   5. Remove as funções de setup de dados demo
-- ============================================================================

BEGIN;

-- ============================================================================
-- ETAPA 1: Deletar itens de pedido relacionados aos produtos
-- ============================================================================
-- Primeiro, deletar itens de pedido que referenciam produtos
DELETE FROM public.itens_pedido 
WHERE produto_id IN (SELECT id FROM public.produtos);

-- Também deletar de delivery_order_items se existir
DELETE FROM public.delivery_order_items 
WHERE produto_id IN (SELECT id FROM public.produtos);

-- ============================================================================
-- ETAPA 2: Deletar todos os produtos de todas as empresas
-- ============================================================================
DELETE FROM public.produtos;

RAISE NOTICE 'Produtos deletados com sucesso';

-- ============================================================================
-- ETAPA 3: Deletar todas as categorias de todas as empresas
-- ============================================================================
DELETE FROM public.categorias;

RAISE NOTICE 'Categorias deletadas com sucesso';

-- ============================================================================
-- ETAPA 4: Deletar pedidos relacionados às mesas
-- ============================================================================
-- Limpar referências de mesas em pedidos
UPDATE public.pedidos SET mesa_id = NULL WHERE mesa_id IS NOT NULL;

-- ============================================================================
-- ETAPA 5: Deletar todas as mesas de todas as empresas
-- ============================================================================
DELETE FROM public.mesas;

RAISE NOTICE 'Mesas deletadas com sucesso';

-- ============================================================================
-- ETAPA 6: Remover o trigger de criação automática
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_criar_dados_iniciais_empresa ON public.empresas;

RAISE NOTICE 'Trigger de criação automática removido';

-- ============================================================================
-- ETAPA 7: Remover as funções de setup de dados demo
-- ============================================================================
DROP FUNCTION IF EXISTS public.trigger_setup_empresa_dados_iniciais() CASCADE;
DROP FUNCTION IF EXISTS public.setup_dados_iniciais_empresa(uuid) CASCADE;

RAISE NOTICE 'Funções de setup removidas';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================
DO $$
DECLARE
  v_mesas_count INTEGER;
  v_produtos_count INTEGER;
  v_categorias_count INTEGER;
  v_trigger_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_mesas_count FROM public.mesas;
  SELECT COUNT(*) INTO v_produtos_count FROM public.produtos;
  SELECT COUNT(*) INTO v_categorias_count FROM public.categorias;
  
  SELECT EXISTS(
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_criar_dados_iniciais_empresa'
  ) INTO v_trigger_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICAÇÃO FINAL:';
  RAISE NOTICE 'Mesas restantes: %', v_mesas_count;
  RAISE NOTICE 'Produtos restantes: %', v_produtos_count;
  RAISE NOTICE 'Categorias restantes: %', v_categorias_count;
  RAISE NOTICE 'Trigger existe: %', v_trigger_exists;
  RAISE NOTICE '========================================';
END;
$$;

COMMIT;
