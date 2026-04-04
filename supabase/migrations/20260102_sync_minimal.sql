-- ============================================================================
-- SINCRONIZAÇÃO MINIMALISTA - FOODIE COMANDA
-- ============================================================================
-- Este script adiciona APENAS o que está faltando
-- NÃO modifica tabelas ou políticas existentes
-- ============================================================================

-- ============================================================================
-- PARTE 1: ADICIONAR COLUNAS FALTANTES
-- ============================================================================

-- Tabela: comandas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comandas' AND column_name='telefone_cliente') THEN
    ALTER TABLE public.comandas ADD COLUMN telefone_cliente TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comandas' AND column_name='comanda_mestre_id') THEN
    ALTER TABLE public.comandas ADD COLUMN comanda_mestre_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='comandas' AND column_name='updated_at') THEN
    ALTER TABLE public.comandas ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Tabela: config_delivery
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='config_delivery' AND column_name='valor_minimo_pedido') THEN
    ALTER TABLE public.config_delivery ADD COLUMN valor_minimo_pedido DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='config_delivery' AND column_name='ativo') THEN
    ALTER TABLE public.config_delivery ADD COLUMN ativo BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='config_delivery' AND column_name='dias_funcionamento') THEN
    ALTER TABLE public.config_delivery ADD COLUMN dias_funcionamento INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6];
  END IF;
END $$;

-- Tabela: itens_delivery
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='itens_delivery' AND column_name='created_at') THEN
    ALTER TABLE public.itens_delivery ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PARTE 2: CRIAR APENAS AS NOVAS TABELAS
-- ============================================================================

-- chat_conversas
CREATE TABLE IF NOT EXISTS public.chat_conversas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'ativa',
  ultima_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- chat_mensagens
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- notificacoes_push
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

-- password_reset_tokens
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- delivery_tracking
CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  status delivery_status NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- analytics_eventos
CREATE TABLE IF NOT EXISTS public.analytics_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  dados JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- relatorio_vendas_diarias
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

-- relatorio_produtos_vendidos
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

-- relatorio_horarios_pico
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

-- relatorio_clientes_inativos
CREATE TABLE IF NOT EXISTS public.relatorio_clientes_inativos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ultima_compra TIMESTAMPTZ,
  dias_inativo INTEGER,
  total_gasto DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- relatorio_fidelidade_clientes
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

DO $$
BEGIN
  -- Só habilita RLS se a tabela foi criada agora
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'chat_conversas' AND schemaname = 'public') THEN
    ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'chat_mensagens' AND schemaname = 'public') THEN
    ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'notificacoes_push' AND schemaname = 'public') THEN
    ALTER TABLE public.notificacoes_push ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'password_reset_tokens' AND schemaname = 'public') THEN
    ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'delivery_tracking' AND schemaname = 'public') THEN
    ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'analytics_eventos' AND schemaname = 'public') THEN
    ALTER TABLE public.analytics_eventos ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'relatorio_vendas_diarias' AND schemaname = 'public') THEN
    ALTER TABLE public.relatorio_vendas_diarias ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'relatorio_produtos_vendidos' AND schemaname = 'public') THEN
    ALTER TABLE public.relatorio_produtos_vendidos ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'relatorio_horarios_pico' AND schemaname = 'public') THEN
    ALTER TABLE public.relatorio_horarios_pico ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'relatorio_clientes_inativos' AND schemaname = 'public') THEN
    ALTER TABLE public.relatorio_clientes_inativos ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'relatorio_fidelidade_clientes' AND schemaname = 'public') THEN
    ALTER TABLE public.relatorio_fidelidade_clientes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- PARTE 4: POLÍTICAS APENAS PARA NOVAS TABELAS
-- ============================================================================

-- Chat Conversas (só cria se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_conversas' AND policyname = 'Users can view own conversations') THEN
    CREATE POLICY "Users can view own conversations"
      ON public.chat_conversas FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_conversas' AND policyname = 'Users can create own conversations') THEN
    CREATE POLICY "Users can create own conversations"
      ON public.chat_conversas FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Chat Mensagens
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_mensagens' AND policyname = 'Users can view messages from own conversations') THEN
    CREATE POLICY "Users can view messages from own conversations"
      ON public.chat_mensagens FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.chat_conversas 
          WHERE id = conversa_id AND user_id = auth.uid()
        )
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_mensagens' AND policyname = 'Users can send messages') THEN
    CREATE POLICY "Users can send messages"
      ON public.chat_mensagens FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.chat_conversas 
          WHERE id = conversa_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Notificações Push
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notificacoes_push' AND policyname = 'Users can view own notifications') THEN
    CREATE POLICY "Users can view own notifications"
      ON public.notificacoes_push FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notificacoes_push' AND policyname = 'Users can update own notifications') THEN
    CREATE POLICY "Users can update own notifications"
      ON public.notificacoes_push FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Delivery Tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delivery_tracking' AND policyname = 'Public can view delivery tracking') THEN
    CREATE POLICY "Public can view delivery tracking"
      ON public.delivery_tracking FOR SELECT
      USING (true);
  END IF;
END $$;

-- Analytics
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'analytics_eventos' AND policyname = 'Staff can manage analytics') THEN
    CREATE POLICY "Staff can manage analytics"
      ON public.analytics_eventos FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.empresa_id = analytics_eventos.empresa_id
        )
      );
  END IF;
END $$;

-- Relatórios
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'relatorio_vendas_diarias' AND policyname = 'Staff can view sales reports') THEN
    CREATE POLICY "Staff can view sales reports"
      ON public.relatorio_vendas_diarias FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_vendas_diarias.empresa_id
        )
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'relatorio_produtos_vendidos' AND policyname = 'Staff can view product reports') THEN
    CREATE POLICY "Staff can view product reports"
      ON public.relatorio_produtos_vendidos FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_produtos_vendidos.empresa_id
        )
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'relatorio_horarios_pico' AND policyname = 'Staff can view peak hours') THEN
    CREATE POLICY "Staff can view peak hours"
      ON public.relatorio_horarios_pico FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_horarios_pico.empresa_id
        )
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'relatorio_clientes_inativos' AND policyname = 'Staff can view inactive clients') THEN
    CREATE POLICY "Staff can view inactive clients"
      ON public.relatorio_clientes_inativos FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_clientes_inativos.empresa_id
        )
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'relatorio_fidelidade_clientes' AND policyname = 'Staff can view loyalty reports') THEN
    CREATE POLICY "Staff can view loyalty reports"
      ON public.relatorio_fidelidade_clientes FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_fidelidade_clientes.empresa_id
        )
      );
  END IF;
END $$;

-- ============================================================================
-- PARTE 5: ÍNDICES PARA NOVAS TABELAS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chat_conversas_user ON public.chat_conversas(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_empresa ON public.chat_conversas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa ON public.chat_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes_push(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes_push(user_id, lida);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_pedido ON public.delivery_tracking(pedido_delivery_id);
CREATE INDEX IF NOT EXISTS idx_analytics_empresa ON public.analytics_eventos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_analytics_tipo ON public.analytics_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_relatorio_vendas_empresa_data ON public.relatorio_vendas_diarias(empresa_id, data);
CREATE INDEX IF NOT EXISTS idx_relatorio_produtos_empresa ON public.relatorio_produtos_vendidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_horarios_empresa ON public.relatorio_horarios_pico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_inativos_empresa ON public.relatorio_clientes_inativos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_fidelidade_empresa ON public.relatorio_fidelidade_clientes(empresa_id);

-- ============================================================================
-- PARTE 6: TRIGGER PARA COMANDAS (se não existir)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_comandas_updated_at') THEN
    CREATE TRIGGER update_comandas_updated_at
      BEFORE UPDATE ON public.comandas
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_conversas_updated_at') THEN
    CREATE TRIGGER update_chat_conversas_updated_at
      BEFORE UPDATE ON public.chat_conversas
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- PARTE 7: FUNÇÕES RPC (se não existirem)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_endereco(
  p_user_id UUID,
  p_nome_cliente TEXT,
  p_telefone TEXT,
  p_rua TEXT,
  p_numero TEXT,
  p_complemento TEXT,
  p_bairro TEXT,
  p_cidade TEXT,
  p_estado TEXT,
  p_cep TEXT,
  p_referencia TEXT,
  p_is_default BOOLEAN
)
RETURNS UUID AS $$
DECLARE
  v_endereco_id UUID;
BEGIN
  SELECT id INTO v_endereco_id
  FROM public.enderecos_cliente
  WHERE user_id = p_user_id
    AND rua = p_rua
    AND numero = p_numero
    AND COALESCE(complemento, '') = COALESCE(p_complemento, '')
    AND bairro = p_bairro
  LIMIT 1;
  
  IF v_endereco_id IS NULL THEN
    INSERT INTO public.enderecos_cliente (
      user_id, nome_cliente, telefone, rua, numero, complemento,
      bairro, cidade, estado, cep, referencia, is_default
    ) VALUES (
      p_user_id, p_nome_cliente, p_telefone, p_rua, p_numero, p_complemento,
      p_bairro, p_cidade, p_estado, p_cep, p_referencia, p_is_default
    )
    RETURNING id INTO v_endereco_id;
  END IF;
  
  RETURN v_endereco_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_default_address(p_endereco_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.enderecos_cliente
  SET is_default = false
  WHERE user_id = p_user_id;
  
  UPDATE public.enderecos_cliente
  SET is_default = true
  WHERE id = p_endereco_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CONCLUSÃO
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Sincronização minimalista concluída!';
  RAISE NOTICE '📊 Colunas adicionadas nas tabelas existentes';
  RAISE NOTICE '🆕 Novas tabelas criadas';
  RAISE NOTICE '🔒 RLS habilitado nas novas tabelas';
  RAISE NOTICE '⚡ Índices criados';
  RAISE NOTICE '🎯 Políticas existentes preservadas!';
END$$;
