-- ============================================================================
-- SINCRONIZAÇÃO SUPER LIMPA - FOODIE COMANDA
-- ============================================================================
-- Este script SOMENTE:
-- 1. Adiciona colunas faltantes
-- 2. Cria tabelas novas
-- 3. NÃO mexe em políticas existentes
-- ============================================================================

-- ============================================================================
-- PARTE 1: ADICIONAR COLUNAS FALTANTES (SEM TOCAR EM NADA MAIS)
-- ============================================================================

-- comandas: adicionar colunas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comandas' AND column_name='telefone_cliente') THEN
    ALTER TABLE public.comandas ADD COLUMN telefone_cliente TEXT;
    RAISE NOTICE 'Coluna telefone_cliente adicionada em comandas';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comandas' AND column_name='comanda_mestre_id') THEN
    ALTER TABLE public.comandas ADD COLUMN comanda_mestre_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL;
    RAISE NOTICE 'Coluna comanda_mestre_id adicionada em comandas';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comandas' AND column_name='updated_at') THEN
    ALTER TABLE public.comandas ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Coluna updated_at adicionada em comandas';
  END IF;
END $$;

-- config_delivery: adicionar colunas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='config_delivery' AND column_name='valor_minimo_pedido') THEN
    ALTER TABLE public.config_delivery ADD COLUMN valor_minimo_pedido DECIMAL(10,2) DEFAULT 0;
    RAISE NOTICE 'Coluna valor_minimo_pedido adicionada em config_delivery';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='config_delivery' AND column_name='ativo') THEN
    ALTER TABLE public.config_delivery ADD COLUMN ativo BOOLEAN DEFAULT true;
    RAISE NOTICE 'Coluna ativo adicionada em config_delivery';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='config_delivery' AND column_name='dias_funcionamento') THEN
    ALTER TABLE public.config_delivery ADD COLUMN dias_funcionamento INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6];
    RAISE NOTICE 'Coluna dias_funcionamento adicionada em config_delivery';
  END IF;
END $$;

-- itens_delivery: adicionar created_at
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='itens_delivery' AND column_name='created_at') THEN
    ALTER TABLE public.itens_delivery ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Coluna created_at adicionada em itens_delivery';
  END IF;
END $$;

-- ============================================================================
-- PARTE 2: CRIAR APENAS AS 11 NOVAS TABELAS
-- ============================================================================

-- 1. chat_conversas
CREATE TABLE IF NOT EXISTS public.chat_conversas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'ativa',
  ultima_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. chat_mensagens
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. notificacoes_push
CREATE TABLE IF NOT EXISTS public.notificacoes_push (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT,
  data JSONB,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. password_reset_tokens
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. delivery_tracking
CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  status delivery_status NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. analytics_eventos
CREATE TABLE IF NOT EXISTS public.analytics_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  dados JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. relatorio_vendas_diarias
CREATE TABLE IF NOT EXISTS public.relatorio_vendas_diarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  total_vendas DECIMAL(10,2) DEFAULT 0,
  total_pedidos INTEGER DEFAULT 0,
  ticket_medio DECIMAL(10,2) DEFAULT 0,
  total_delivery DECIMAL(10,2) DEFAULT 0,
  total_presencial DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, data)
);

-- 8. relatorio_produtos_vendidos
CREATE TABLE IF NOT EXISTS public.relatorio_produtos_vendidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome_produto TEXT NOT NULL,
  quantidade_vendida INTEGER DEFAULT 0,
  receita_total DECIMAL(10,2) DEFAULT 0,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. relatorio_horarios_pico
CREATE TABLE IF NOT EXISTS public.relatorio_horarios_pico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL,
  hora INTEGER NOT NULL,
  quantidade_pedidos INTEGER DEFAULT 0,
  receita DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, dia_semana, hora)
);

-- 10. relatorio_clientes_inativos
CREATE TABLE IF NOT EXISTS public.relatorio_clientes_inativos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ultima_compra TIMESTAMPTZ,
  dias_inativo INTEGER,
  total_gasto DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. relatorio_fidelidade_clientes
CREATE TABLE IF NOT EXISTS public.relatorio_fidelidade_clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_pontos INTEGER DEFAULT 0,
  pontos_gastos INTEGER DEFAULT 0,
  total_pedidos INTEGER DEFAULT 0,
  valor_total_gasto DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PARTE 3: HABILITAR RLS NAS NOVAS TABELAS
-- ============================================================================

ALTER TABLE IF EXISTS public.chat_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notificacoes_push ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analytics_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.relatorio_vendas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.relatorio_produtos_vendidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.relatorio_horarios_pico ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.relatorio_clientes_inativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.relatorio_fidelidade_clientes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 4: POLÍTICAS APENAS PARA AS 11 NOVAS TABELAS
-- ============================================================================

-- Função auxiliar para verificar se política existe
CREATE OR REPLACE FUNCTION policy_exists(p_table text, p_policy text) 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = p_table AND policyname = p_policy
  );
END;
$$ LANGUAGE plpgsql;

-- Chat Conversas
DO $$
BEGIN
  IF NOT policy_exists('chat_conversas', 'chat_conversas_select') THEN
    EXECUTE 'CREATE POLICY chat_conversas_select ON public.chat_conversas FOR SELECT USING (auth.uid() = user_id)';
  END IF;
  IF NOT policy_exists('chat_conversas', 'chat_conversas_insert') THEN
    EXECUTE 'CREATE POLICY chat_conversas_insert ON public.chat_conversas FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- Chat Mensagens
DO $$
BEGIN
  IF NOT policy_exists('chat_mensagens', 'chat_mensagens_select') THEN
    EXECUTE 'CREATE POLICY chat_mensagens_select ON public.chat_mensagens FOR SELECT USING (EXISTS (SELECT 1 FROM public.chat_conversas WHERE id = conversa_id AND user_id = auth.uid()))';
  END IF;
  IF NOT policy_exists('chat_mensagens', 'chat_mensagens_insert') THEN
    EXECUTE 'CREATE POLICY chat_mensagens_insert ON public.chat_mensagens FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.chat_conversas WHERE id = conversa_id AND user_id = auth.uid()))';
  END IF;
END $$;

-- Notificações Push
DO $$
BEGIN
  IF NOT policy_exists('notificacoes_push', 'notificacoes_push_select') THEN
    EXECUTE 'CREATE POLICY notificacoes_push_select ON public.notificacoes_push FOR SELECT USING (auth.uid() = user_id)';
  END IF;
  IF NOT policy_exists('notificacoes_push', 'notificacoes_push_update') THEN
    EXECUTE 'CREATE POLICY notificacoes_push_update ON public.notificacoes_push FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Delivery Tracking (público)
DO $$
BEGIN
  IF NOT policy_exists('delivery_tracking', 'delivery_tracking_select') THEN
    EXECUTE 'CREATE POLICY delivery_tracking_select ON public.delivery_tracking FOR SELECT USING (true)';
  END IF;
END $$;

-- Analytics (staff apenas)
DO $$
BEGIN
  IF NOT policy_exists('analytics_eventos', 'analytics_eventos_all') THEN
    EXECUTE 'CREATE POLICY analytics_eventos_all ON public.analytics_eventos FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.empresa_id = analytics_eventos.empresa_id))';
  END IF;
END $$;

-- Relatório Vendas Diárias
DO $$
BEGIN
  IF NOT policy_exists('relatorio_vendas_diarias', 'relatorio_vendas_diarias_select') THEN
    EXECUTE 'CREATE POLICY relatorio_vendas_diarias_select ON public.relatorio_vendas_diarias FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_vendas_diarias.empresa_id))';
  END IF;
END $$;

-- Relatório Produtos Vendidos
DO $$
BEGIN
  IF NOT policy_exists('relatorio_produtos_vendidos', 'relatorio_produtos_vendidos_select') THEN
    EXECUTE 'CREATE POLICY relatorio_produtos_vendidos_select ON public.relatorio_produtos_vendidos FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_produtos_vendidos.empresa_id))';
  END IF;
END $$;

-- Relatório Horários Pico
DO $$
BEGIN
  IF NOT policy_exists('relatorio_horarios_pico', 'relatorio_horarios_pico_select') THEN
    EXECUTE 'CREATE POLICY relatorio_horarios_pico_select ON public.relatorio_horarios_pico FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_horarios_pico.empresa_id))';
  END IF;
END $$;

-- Relatório Clientes Inativos
DO $$
BEGIN
  IF NOT policy_exists('relatorio_clientes_inativos', 'relatorio_clientes_inativos_select') THEN
    EXECUTE 'CREATE POLICY relatorio_clientes_inativos_select ON public.relatorio_clientes_inativos FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_clientes_inativos.empresa_id))';
  END IF;
END $$;

-- Relatório Fidelidade Clientes
DO $$
BEGIN
  IF NOT policy_exists('relatorio_fidelidade_clientes', 'relatorio_fidelidade_clientes_select') THEN
    EXECUTE 'CREATE POLICY relatorio_fidelidade_clientes_select ON public.relatorio_fidelidade_clientes FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_fidelidade_clientes.empresa_id))';
  END IF;
END $$;

-- Limpar função temporária
DROP FUNCTION IF EXISTS policy_exists(text, text);

-- ============================================================================
-- PARTE 5: ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chat_conversas_user ON public.chat_conversas(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_empresa ON public.chat_conversas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa ON public.chat_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes_push(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes_push(user_id, lida);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_pedido ON public.delivery_tracking(pedido_delivery_id);
CREATE INDEX IF NOT EXISTS idx_analytics_empresa ON public.analytics_eventos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_vendas_empresa_data ON public.relatorio_vendas_diarias(empresa_id, data);
CREATE INDEX IF NOT EXISTS idx_relatorio_produtos_empresa ON public.relatorio_produtos_vendidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_horarios_empresa ON public.relatorio_horarios_pico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_inativos_empresa ON public.relatorio_clientes_inativos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_fidelidade_empresa ON public.relatorio_fidelidade_clientes(empresa_id);

-- ============================================================================
-- PARTE 6: TRIGGERS (apenas para novas tabelas)
-- ============================================================================

-- Função para updated_at (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para chat_conversas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_conversas_updated_at') THEN
    CREATE TRIGGER update_chat_conversas_updated_at
      BEFORE UPDATE ON public.chat_conversas
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Trigger para comandas (se tiver updated_at e não tiver trigger)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comandas' AND column_name='updated_at')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_comandas_updated_at') THEN
    CREATE TRIGGER update_comandas_updated_at
      BEFORE UPDATE ON public.comandas
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- CONCLUSÃO
-- ============================================================================

DO $$
DECLARE
  total_novas_tabelas int;
  total_colunas_adicionadas int := 0;
BEGIN
  -- Contar novas tabelas criadas
  SELECT COUNT(*) INTO total_novas_tabelas
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN (
    'chat_conversas', 'chat_mensagens', 'notificacoes_push',
    'password_reset_tokens', 'delivery_tracking', 'analytics_eventos',
    'relatorio_vendas_diarias', 'relatorio_produtos_vendidos',
    'relatorio_horarios_pico', 'relatorio_clientes_inativos',
    'relatorio_fidelidade_clientes'
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '📊 Tabelas novas criadas: %', total_novas_tabelas;
  RAISE NOTICE '➕ Colunas adicionadas em tabelas existentes';
  RAISE NOTICE '🔒 RLS habilitado nas novas tabelas';
  RAISE NOTICE '⚡ Índices criados para performance';
  RAISE NOTICE '🎯 Políticas existentes PRESERVADAS (zero conflitos)';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
END $$;
