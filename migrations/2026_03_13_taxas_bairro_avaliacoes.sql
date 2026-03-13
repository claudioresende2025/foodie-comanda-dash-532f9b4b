-- =====================================================
-- TAXA DE ENTREGA POR BAIRRO + SISTEMA DE AVALIAÇÕES
-- Data: 2026-03-13
-- =====================================================

-- =====================================================
-- 0. LIMPEZA PRÉVIA - Dropar objetos se existirem
-- =====================================================

-- Dropar views primeiro (dependem das tabelas)
DROP VIEW IF EXISTS public.vendas_por_bairro;
DROP VIEW IF EXISTS public.clientes_stats;
DROP VIEW IF EXISTS public.avaliacoes_stats;

-- Dropar tabelas com CASCADE (remove triggers e constraints automaticamente)
DROP TABLE IF EXISTS public.avaliacoes_pendentes CASCADE;
DROP TABLE IF EXISTS public.avaliacoes CASCADE;
DROP TABLE IF EXISTS public.taxas_bairro CASCADE;

-- Dropar trigger da tabela pedidos_delivery (tabela existe, só dropar trigger)
DROP TRIGGER IF EXISTS criar_avaliacao_pendente_trigger ON public.pedidos_delivery;

-- Dropar funções
DROP FUNCTION IF EXISTS public.criar_avaliacao_pendente() CASCADE;
DROP FUNCTION IF EXISTS public.get_taxa_entrega_bairro(UUID, TEXT) CASCADE;

-- =====================================================
-- 1. TABELA TAXAS_BAIRRO
-- Permite cadastrar taxa de entrega por bairro
-- =====================================================

CREATE TABLE public.taxas_bairro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  bairro TEXT NOT NULL,
  bairro_normalizado TEXT NOT NULL GENERATED ALWAYS AS (LOWER(TRIM(bairro))) STORED,
  taxa DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Um bairro por empresa
  CONSTRAINT taxas_bairro_empresa_bairro_unique UNIQUE (empresa_id, bairro_normalizado)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_taxas_bairro_empresa ON public.taxas_bairro(empresa_id);
CREATE INDEX IF NOT EXISTS idx_taxas_bairro_normalizado ON public.taxas_bairro(bairro_normalizado);
CREATE INDEX IF NOT EXISTS idx_taxas_bairro_ativo ON public.taxas_bairro(ativo) WHERE ativo = true;

-- Habilitar RLS
ALTER TABLE public.taxas_bairro ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "taxas_bairro_select_public" ON public.taxas_bairro;
DROP POLICY IF EXISTS "taxas_bairro_insert_staff" ON public.taxas_bairro;
DROP POLICY IF EXISTS "taxas_bairro_update_staff" ON public.taxas_bairro;
DROP POLICY IF EXISTS "taxas_bairro_delete_staff" ON public.taxas_bairro;

-- SELECT público para bairros ativos (clientes precisam ver taxas)
CREATE POLICY "taxas_bairro_select_public"
ON public.taxas_bairro
FOR SELECT
USING (ativo = true OR EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.empresa_id = taxas_bairro.empresa_id
  AND ur.role IN ('proprietario', 'gerente')
));

-- INSERT para staff da empresa
CREATE POLICY "taxas_bairro_insert_staff"
ON public.taxas_bairro
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.empresa_id = taxas_bairro.empresa_id
  AND ur.role IN ('proprietario', 'gerente')
));

-- UPDATE para staff da empresa
CREATE POLICY "taxas_bairro_update_staff"
ON public.taxas_bairro
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.empresa_id = taxas_bairro.empresa_id
  AND ur.role IN ('proprietario', 'gerente')
));

-- DELETE para staff da empresa
CREATE POLICY "taxas_bairro_delete_staff"
ON public.taxas_bairro
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.empresa_id = taxas_bairro.empresa_id
  AND ur.role IN ('proprietario', 'gerente')
));

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER update_taxas_bairro_updated_at
BEFORE UPDATE ON public.taxas_bairro
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Grants
GRANT SELECT ON public.taxas_bairro TO anon;
GRANT SELECT ON public.taxas_bairro TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.taxas_bairro TO authenticated;

-- =====================================================
-- 2. TABELA AVALIACOES
-- Avaliações de restaurantes e produtos pelos clientes
-- =====================================================

CREATE TABLE public.avaliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nota_restaurante INTEGER NOT NULL CHECK (nota_restaurante >= 1 AND nota_restaurante <= 5),
  nota_produto INTEGER CHECK (nota_produto IS NULL OR (nota_produto >= 1 AND nota_produto <= 5)),
  comentario TEXT,
  nome_cliente TEXT NOT NULL,
  bairro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Uma avaliação por pedido
  CONSTRAINT avaliacoes_pedido_unique UNIQUE (pedido_delivery_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_avaliacoes_empresa ON public.avaliacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_user ON public.avaliacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_created ON public.avaliacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_nota_restaurante ON public.avaliacoes(nota_restaurante);

-- Habilitar RLS
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "avaliacoes_select_own" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_select_staff" ON public.avaliacoes;
DROP POLICY IF EXISTS "avaliacoes_insert" ON public.avaliacoes;

-- SELECT para próprias avaliações
CREATE POLICY "avaliacoes_select_own"
ON public.avaliacoes
FOR SELECT
USING (auth.uid() = user_id);

-- SELECT para staff da empresa
CREATE POLICY "avaliacoes_select_staff"
ON public.avaliacoes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.empresa_id = avaliacoes.empresa_id
  AND ur.role IN ('proprietario', 'gerente', 'garcom', 'caixa')
));

-- INSERT para usuários autenticados
CREATE POLICY "avaliacoes_insert"
ON public.avaliacoes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Grants
GRANT SELECT ON public.avaliacoes TO authenticated;
GRANT INSERT ON public.avaliacoes TO authenticated;

-- =====================================================
-- 3. TABELA AVALIACOES_PENDENTES
-- Avaliações pendentes para exibir no próximo login
-- =====================================================

CREATE TABLE public.avaliacoes_pendentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_restaurante TEXT NOT NULL,
  bairro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expirado BOOLEAN NOT NULL DEFAULT false,
  -- Uma pendência por pedido
  CONSTRAINT avaliacoes_pendentes_pedido_unique UNIQUE (pedido_delivery_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_avaliacoes_pendentes_user ON public.avaliacoes_pendentes(user_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_pendentes_empresa ON public.avaliacoes_pendentes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_pendentes_expirado ON public.avaliacoes_pendentes(expirado) WHERE expirado = false;

-- Habilitar RLS
ALTER TABLE public.avaliacoes_pendentes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "avaliacoes_pendentes_select_own" ON public.avaliacoes_pendentes;
DROP POLICY IF EXISTS "avaliacoes_pendentes_insert" ON public.avaliacoes_pendentes;
DROP POLICY IF EXISTS "avaliacoes_pendentes_delete_own" ON public.avaliacoes_pendentes;

-- SELECT para próprias pendências
CREATE POLICY "avaliacoes_pendentes_select_own"
ON public.avaliacoes_pendentes
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT via trigger (SECURITY DEFINER)
CREATE POLICY "avaliacoes_pendentes_insert"
ON public.avaliacoes_pendentes
FOR INSERT
WITH CHECK (true);

-- DELETE para próprias pendências (após avaliar)
CREATE POLICY "avaliacoes_pendentes_delete_own"
ON public.avaliacoes_pendentes
FOR DELETE
USING (auth.uid() = user_id);

-- Grants
GRANT SELECT, DELETE ON public.avaliacoes_pendentes TO authenticated;
GRANT INSERT ON public.avaliacoes_pendentes TO authenticated;

-- =====================================================
-- 4. TRIGGER PARA CRIAR AVALIAÇÃO PENDENTE
-- Quando pedido muda para 'entregue'
-- =====================================================

CREATE OR REPLACE FUNCTION public.criar_avaliacao_pendente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_restaurante TEXT;
  v_bairro TEXT;
BEGIN
  -- Só executar quando status muda para 'entregue'
  IF NEW.status = 'entregue' AND (OLD.status IS NULL OR OLD.status != 'entregue') THEN
    -- Buscar nome do restaurante
    SELECT nome_fantasia INTO v_nome_restaurante
    FROM empresas
    WHERE id = NEW.empresa_id;
    
    -- Buscar bairro do endereço
    SELECT bairro INTO v_bairro
    FROM enderecos_cliente
    WHERE id = NEW.endereco_id;
    
    -- Inserir avaliação pendente (ignorar se já existe)
    INSERT INTO avaliacoes_pendentes (
      user_id,
      pedido_delivery_id,
      empresa_id,
      nome_restaurante,
      bairro
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.empresa_id,
      COALESCE(v_nome_restaurante, 'Restaurante'),
      v_bairro
    )
    ON CONFLICT (pedido_delivery_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS criar_avaliacao_pendente_trigger ON public.pedidos_delivery;
CREATE TRIGGER criar_avaliacao_pendente_trigger
AFTER INSERT OR UPDATE ON public.pedidos_delivery
FOR EACH ROW
EXECUTE FUNCTION public.criar_avaliacao_pendente();

-- =====================================================
-- 5. FUNÇÃO PARA BUSCAR TAXA POR BAIRRO
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_taxa_entrega_bairro(
  p_empresa_id UUID,
  p_bairro TEXT
)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_taxa DECIMAL(10, 2);
  v_taxa_padrao DECIMAL(10, 2);
BEGIN
  -- Buscar taxa do bairro
  SELECT taxa INTO v_taxa
  FROM taxas_bairro
  WHERE empresa_id = p_empresa_id
  AND bairro_normalizado = LOWER(TRIM(p_bairro))
  AND ativo = true
  LIMIT 1;
  
  -- Se encontrou, retornar
  IF v_taxa IS NOT NULL THEN
    RETURN v_taxa;
  END IF;
  
  -- Caso contrário, buscar taxa padrão da config_delivery
  SELECT taxa_entrega INTO v_taxa_padrao
  FROM config_delivery
  WHERE empresa_id = p_empresa_id
  LIMIT 1;
  
  RETURN COALESCE(v_taxa_padrao, 0);
END;
$$;

-- Grant para a função
GRANT EXECUTE ON FUNCTION public.get_taxa_entrega_bairro(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_taxa_entrega_bairro(UUID, TEXT) TO authenticated;

-- =====================================================
-- 6. VIEW PARA ESTATÍSTICAS DE AVALIAÇÕES
-- =====================================================

CREATE OR REPLACE VIEW public.avaliacoes_stats AS
SELECT 
  empresa_id,
  COUNT(*) as total_avaliacoes,
  ROUND(AVG(nota_restaurante)::numeric, 2) as media_restaurante,
  ROUND(AVG(nota_produto)::numeric, 2) as media_produto,
  COUNT(CASE WHEN nota_restaurante = 5 THEN 1 END) as cinco_estrelas,
  COUNT(CASE WHEN nota_restaurante = 4 THEN 1 END) as quatro_estrelas,
  COUNT(CASE WHEN nota_restaurante = 3 THEN 1 END) as tres_estrelas,
  COUNT(CASE WHEN nota_restaurante = 2 THEN 1 END) as duas_estrelas,
  COUNT(CASE WHEN nota_restaurante = 1 THEN 1 END) as uma_estrela
FROM avaliacoes
GROUP BY empresa_id;

-- Grant para a view
GRANT SELECT ON public.avaliacoes_stats TO authenticated;

-- =====================================================
-- 7. VIEW PARA ESTATÍSTICAS DE CLIENTES
-- =====================================================

CREATE OR REPLACE VIEW public.clientes_stats AS
SELECT 
  pd.empresa_id,
  pd.user_id,
  MAX(COALESCE(a.nome_cliente, ec.nome_cliente, 'Cliente')) as nome_cliente,
  MAX(ec.bairro) as bairro,
  COUNT(pd.id) as total_pedidos,
  SUM(pd.total) as valor_total,
  MAX(pd.created_at) as ultimo_pedido,
  MIN(pd.created_at) as primeiro_pedido
FROM pedidos_delivery pd
LEFT JOIN enderecos_cliente ec ON pd.endereco_id = ec.id
LEFT JOIN avaliacoes a ON pd.id = a.pedido_delivery_id
WHERE pd.status NOT IN ('cancelado')
GROUP BY pd.empresa_id, pd.user_id;

-- Grant para a view
GRANT SELECT ON public.clientes_stats TO authenticated;

-- =====================================================
-- 8. VIEW PARA VENDAS POR BAIRRO
-- =====================================================

CREATE OR REPLACE VIEW public.vendas_por_bairro AS
SELECT 
  pd.empresa_id,
  COALESCE(ec.bairro, 'Não informado') as bairro,
  COUNT(pd.id) as total_pedidos,
  SUM(pd.total) as valor_total,
  ROUND(AVG(pd.total)::numeric, 2) as ticket_medio
FROM pedidos_delivery pd
LEFT JOIN enderecos_cliente ec ON pd.endereco_id = ec.id
WHERE pd.status NOT IN ('cancelado')
GROUP BY pd.empresa_id, ec.bairro;

-- Grant para a view
GRANT SELECT ON public.vendas_por_bairro TO authenticated;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela taxas_bairro criada com sucesso';
  RAISE NOTICE '✅ Tabela avaliacoes criada com sucesso';
  RAISE NOTICE '✅ Tabela avaliacoes_pendentes criada com sucesso';
  RAISE NOTICE '✅ Trigger criar_avaliacao_pendente criado';
  RAISE NOTICE '✅ Função get_taxa_entrega_bairro criada';
  RAISE NOTICE '✅ Views de estatísticas criadas';
  RAISE NOTICE '✅ Políticas RLS configuradas';
END
$$;
