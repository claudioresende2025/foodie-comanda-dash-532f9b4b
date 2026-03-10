-- ============================================================================
-- EXECUTAR NO SUPABASE SQL EDITOR
-- Data: 2026-03-10
-- ============================================================================
-- IMPORTANTE: Este script irá:
--   1. DELETAR todas as mesas de TODAS as empresas
--   2. DELETAR todos os produtos de TODAS as empresas
--   3. DELETAR todas as categorias de TODAS as empresas
--   4. REMOVER o trigger que cria dados demo automaticamente
--
-- Após executar, novas empresas iniciarão com cardápio e mesas zerados
-- ============================================================================

-- ============================================================================
-- ETAPA 1: Deletar itens de delivery relacionados aos produtos (se existir)
-- ============================================================================
DO $$
BEGIN
  -- Tentar deletar de itens_delivery
  DELETE FROM public.itens_delivery 
  WHERE produto_id IN (SELECT id FROM public.produtos);
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Tabela itens_delivery não existe, pulando...';
END $$;

-- ============================================================================
-- ETAPA 2: Limpar referências de produtos em pedidos
-- ============================================================================
UPDATE public.pedidos SET produto_id = NULL WHERE produto_id IS NOT NULL;

-- ============================================================================
-- ETAPA 3: Deletar todos os produtos de todas as empresas
-- ============================================================================
DELETE FROM public.produtos;

-- ============================================================================
-- ETAPA 3: Deletar todas as categorias de todas as empresas
-- ============================================================================
DELETE FROM public.categorias;

-- ============================================================================
-- ETAPA 4: Deletar pedidos relacionados às mesas
-- ============================================================================
UPDATE public.pedidos SET mesa_id = NULL WHERE mesa_id IS NOT NULL;

-- ============================================================================
-- ETAPA 5: Deletar todas as mesas de todas as empresas
-- ============================================================================
DELETE FROM public.mesas;

-- ============================================================================
-- ETAPA 6: Remover o trigger de criação automática
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_criar_dados_iniciais_empresa ON public.empresas;

-- ============================================================================
-- ETAPA 7: Remover as funções de setup de dados demo
-- ============================================================================
DROP FUNCTION IF EXISTS public.trigger_setup_empresa_dados_iniciais() CASCADE;
DROP FUNCTION IF EXISTS public.setup_dados_iniciais_empresa(uuid) CASCADE;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================
SELECT 
  'mesas' as tabela, 
  COUNT(*) as total 
FROM public.mesas
UNION ALL
SELECT 
  'produtos' as tabela, 
  COUNT(*) as total 
FROM public.produtos
UNION ALL
SELECT 
  'categorias' as tabela, 
  COUNT(*) as total 
FROM public.categorias;

-- Verificar se trigger foi removido
SELECT 
  trigger_name,
  'AINDA EXISTE - ERRO!' as status
FROM information_schema.triggers
WHERE trigger_name = 'trigger_criar_dados_iniciais_empresa';
