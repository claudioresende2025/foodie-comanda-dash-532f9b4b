-- ============================================================================
-- SINCRONIZAÇÃO INCREMENTAL - FOODIE COMANDA
-- ============================================================================
-- Script otimizado baseado no estado atual do Supabase (Janeiro 2026)
-- Este script adiciona APENAS o que está faltando
-- ============================================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PARTE 1: ADICIONAR COLUNAS FALTANTES EM TABELAS EXISTENTES
-- ============================================================================

-- Tabela: comandas (adicionar colunas faltantes)
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

-- Tabela: config_delivery (adicionar colunas faltantes)
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

-- Tabela: itens_delivery (adicionar created_at se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='itens_delivery' AND column_name='created_at') THEN
    ALTER TABLE public.itens_delivery ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PARTE 2: CRIAR TABELAS QUE NÃO EXISTEM
-- ============================================================================

-- Tabela: chat_conversas
CREATE TABLE IF NOT EXISTS public.chat_conversas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'ativa',
  ultima_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: chat_mensagens
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: notificacoes_push
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

-- Tabela: password_reset_tokens
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: delivery_tracking
CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  status delivery_status NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: analytics_eventos
CREATE TABLE IF NOT EXISTS public.analytics_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  dados JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: relatorio_vendas_diarias
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

-- Tabela: relatorio_produtos_vendidos
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

-- Tabela: relatorio_horarios_pico
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

-- Tabela: relatorio_clientes_inativos
CREATE TABLE IF NOT EXISTS public.relatorio_clientes_inativos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ultima_compra TIMESTAMPTZ,
  dias_inativo INTEGER,
  total_gasto DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: relatorio_fidelidade_clientes
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

ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_push ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_vendas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_produtos_vendidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_horarios_pico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_clientes_inativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_fidelidade_clientes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 4: REMOVER POLÍTICAS EXISTENTES (PARA EVITAR CONFLITOS)
-- ============================================================================

-- Remover políticas que podem já existir em tabelas antigas
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- PARTE 5: RECRIAR TODAS AS POLÍTICAS RLS
-- ============================================================================

-- Profiles
CREATE POLICY "Usuários podem ver próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem criar próprio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User Roles
CREATE POLICY "Usuários podem ver próprias roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Proprietários podem gerenciar roles"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.empresas 
      WHERE empresas.usuario_proprietario_id = auth.uid() 
      AND empresas.id = user_roles.empresa_id
    )
  );

-- Empresas
CREATE POLICY "Leitura pública de empresas"
  ON public.empresas FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem ver sua própria empresa"
  ON public.empresas FOR SELECT
  USING (
    (id = get_user_empresa_id(auth.uid())) OR 
    (usuario_proprietario_id = auth.uid())
  );

CREATE POLICY "Proprietários podem atualizar sua empresa"
  ON public.empresas FOR UPDATE
  USING (usuario_proprietario_id = auth.uid());

CREATE POLICY "Usuários podem criar empresas"
  ON public.empresas FOR INSERT
  WITH CHECK (auth.uid() = usuario_proprietario_id);

-- Categorias
CREATE POLICY "Leitura pública de categorias ativas"
  ON public.categorias FOR SELECT
  USING (ativo = true);

CREATE POLICY "Ver categorias da empresa"
  ON public.categorias FOR SELECT
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Gerenciar categorias da empresa"
  ON public.categorias FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Produtos
CREATE POLICY "Leitura pública de produtos ativos"
  ON public.produtos FOR SELECT
  USING (ativo = true);

CREATE POLICY "Ver produtos da empresa"
  ON public.produtos FOR SELECT
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Gerenciar produtos da empresa"
  ON public.produtos FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Mesas
CREATE POLICY "Leitura pública de mesas"
  ON public.mesas FOR SELECT
  USING (true);

CREATE POLICY "Ver mesas da empresa"
  ON public.mesas FOR SELECT
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Gerenciar mesas da empresa"
  ON public.mesas FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Comandas
CREATE POLICY "Leitura pública de comandas ativas"
  ON public.comandas FOR SELECT
  USING (status = 'aberta');

CREATE POLICY "Ver comandas da empresa"
  ON public.comandas FOR SELECT
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Gerenciar comandas da empresa"
  ON public.comandas FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Criar comandas públicas para menu"
  ON public.comandas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Atualizar comandas anônimas"
  ON public.comandas FOR UPDATE
  USING (true);

-- Pedidos
CREATE POLICY "Inserir pedidos em comandas abertas"
  ON public.pedidos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.comandas 
      WHERE comandas.id = pedidos.comanda_id 
      AND comandas.status = 'aberta'
    )
  );

CREATE POLICY "Ver pedidos via comanda"
  ON public.pedidos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas 
      WHERE comandas.id = pedidos.comanda_id
    )
  );

CREATE POLICY "Gerenciar pedidos via comanda"
  ON public.pedidos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.comandas 
      WHERE comandas.id = pedidos.comanda_id 
      AND comandas.empresa_id = get_user_empresa_id(auth.uid())
    )
  );

-- Config Delivery
CREATE POLICY "Leitura pública de config delivery"
  ON public.config_delivery FOR SELECT
  USING (ativo = true);

CREATE POLICY "Staff pode gerenciar config delivery"
  ON public.config_delivery FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Endereços Cliente
CREATE POLICY "Usuários podem ver próprios endereços"
  ON public.enderecos_cliente FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar próprios endereços"
  ON public.enderecos_cliente FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar próprios endereços"
  ON public.enderecos_cliente FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir próprios endereços"
  ON public.enderecos_cliente FOR DELETE
  USING (auth.uid() = user_id);

-- Pedidos Delivery
CREATE POLICY "Usuários podem ver próprios pedidos delivery"
  ON public.pedidos_delivery FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Usuários podem criar pedidos delivery"
  ON public.pedidos_delivery FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Staff pode gerenciar pedidos delivery"
  ON public.pedidos_delivery FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Itens Delivery
CREATE POLICY "Ver itens de delivery"
  ON public.itens_delivery FOR SELECT
  USING (true);

CREATE POLICY "Inserir itens delivery autenticado"
  ON public.itens_delivery FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff pode gerenciar itens delivery"
  ON public.itens_delivery FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos_delivery pd
      WHERE pd.id = itens_delivery.pedido_delivery_id
      AND pd.empresa_id = get_user_empresa_id(auth.uid())
    )
  );

-- Caixas
CREATE POLICY "Staff pode gerenciar caixas"
  ON public.caixas FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Movimentações Caixa
CREATE POLICY "Staff pode gerenciar movimentações"
  ON public.movimentacoes_caixa FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.caixas c
      WHERE c.id = movimentacoes_caixa.caixa_id
      AND c.empresa_id = get_user_empresa_id(auth.uid())
    )
  );

-- Chamadas Garçom
CREATE POLICY "Chamadas públicas"
  ON public.chamadas_garcom FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff pode ver chamadas"
  ON public.chamadas_garcom FOR SELECT
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Staff pode gerenciar chamadas"
  ON public.chamadas_garcom FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Reservas
CREATE POLICY "Criar reservas públicas"
  ON public.reservas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Ver próprias reservas"
  ON public.reservas FOR SELECT
  USING (true);

CREATE POLICY "Staff pode gerenciar reservas"
  ON public.reservas FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Combos
CREATE POLICY "Ver combos ativos"
  ON public.combos FOR SELECT
  USING (ativo = true);

CREATE POLICY "Staff pode gerenciar combos"
  ON public.combos FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Combo Itens
CREATE POLICY "Ver combo_itens públicos"
  ON public.combo_itens FOR SELECT
  USING (true);

CREATE POLICY "Staff pode gerenciar combo_itens"
  ON public.combo_itens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.combos c
      WHERE c.id = combo_itens.combo_id
      AND c.empresa_id = get_user_empresa_id(auth.uid())
    )
  );

-- Cupons
CREATE POLICY "Ver cupons ativos"
  ON public.cupons FOR SELECT
  USING (ativo = true);

CREATE POLICY "Admin pode gerenciar cupons"
  ON public.cupons FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Cupons Uso
CREATE POLICY "Staff pode ver cupons_uso"
  ON public.cupons_uso FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cupons c
      WHERE c.id = cupons_uso.cupom_id
      AND c.empresa_id = get_user_empresa_id(auth.uid())
    )
  );

CREATE POLICY "Usuários podem ver próprio uso de cupons"
  ON public.cupons_uso FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem usar cupons"
  ON public.cupons_uso FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Promoções
CREATE POLICY "Ver promoções ativas"
  ON public.promocoes FOR SELECT
  USING (ativo = true);

CREATE POLICY "Admin pode gerenciar promoções"
  ON public.promocoes FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Promoção Itens
CREATE POLICY "Ver promocao_itens públicos"
  ON public.promocao_itens FOR SELECT
  USING (true);

CREATE POLICY "Staff pode gerenciar promocao_itens"
  ON public.promocao_itens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.promocoes p
      WHERE p.id = promocao_itens.promocao_id
      AND p.empresa_id = get_user_empresa_id(auth.uid())
    )
  );

-- Fidelidade Config
CREATE POLICY "Ver config fidelidade ativa"
  ON public.fidelidade_config FOR SELECT
  USING (ativo = true);

CREATE POLICY "Staff pode gerenciar fidelidade_config"
  ON public.fidelidade_config FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Fidelidade Pontos
CREATE POLICY "Usuários podem ver próprios pontos"
  ON public.fidelidade_pontos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir fidelidade"
  ON public.fidelidade_pontos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar fidelidade"
  ON public.fidelidade_pontos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admin pode gerenciar fidelidade pontos"
  ON public.fidelidade_pontos FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Fidelidade Transações
CREATE POLICY "Usuários podem ver próprias transações"
  ON public.fidelidade_transacoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir transações"
  ON public.fidelidade_transacoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff pode gerenciar transações"
  ON public.fidelidade_transacoes FOR ALL
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Avaliações
CREATE POLICY "Staff pode ver avaliações"
  ON public.avaliacoes FOR SELECT
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Usuários podem ver próprias avaliações"
  ON public.avaliacoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar próprias avaliações"
  ON public.avaliacoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Chat Conversas
CREATE POLICY "Users can view own conversations"
  ON public.chat_conversas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON public.chat_conversas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Chat Mensagens
CREATE POLICY "Users can view messages from own conversations"
  ON public.chat_mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversas 
      WHERE id = conversa_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages"
  ON public.chat_mensagens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversas 
      WHERE id = conversa_id AND user_id = auth.uid()
    )
  );

-- Notificações Push
CREATE POLICY "Users can view own notifications"
  ON public.notificacoes_push FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notificacoes_push FOR UPDATE
  USING (auth.uid() = user_id);

-- Delivery Tracking (público para rastreamento)
CREATE POLICY "Public can view delivery tracking"
  ON public.delivery_tracking FOR SELECT
  USING (true);

-- Analytics (apenas staff)
CREATE POLICY "Staff can manage analytics"
  ON public.analytics_eventos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.empresa_id = analytics_eventos.empresa_id
    )
  );

-- Relatórios (apenas staff autenticado)
CREATE POLICY "Staff can view reports"
  ON public.relatorio_vendas_diarias FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_vendas_diarias.empresa_id
    )
  );

CREATE POLICY "Staff can view product reports"
  ON public.relatorio_produtos_vendidos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_produtos_vendidos.empresa_id
    )
  );

CREATE POLICY "Staff can view peak hours"
  ON public.relatorio_horarios_pico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_horarios_pico.empresa_id
    )
  );

CREATE POLICY "Staff can view inactive clients"
  ON public.relatorio_clientes_inativos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_clientes_inativos.empresa_id
    )
  );

CREATE POLICY "Staff can view loyalty reports"
  ON public.relatorio_fidelidade_clientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.empresa_id = relatorio_fidelidade_clientes.empresa_id
    )
  );

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
CREATE INDEX IF NOT EXISTS idx_analytics_tipo ON public.analytics_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_relatorio_vendas_empresa_data ON public.relatorio_vendas_diarias(empresa_id, data);
CREATE INDEX IF NOT EXISTS idx_relatorio_produtos_empresa ON public.relatorio_produtos_vendidos(empresa_id);
CREATE IN6: FUNÇÃO AUXILIAR (se não existir)
-- ============================================================================

-- Função para pegar empresa_id do usuário
CREATE OR REPLACE FUNCTION get_user_empresa_id(p_user_id UUID)
RETURNS U8ID AS $$
BEGIN
  RETURN (
    SELECT empresa_id 
    FROM public.profiles 
    WHERE id = p_user_id 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PARTE 7EX IF NOT EXISTS idx_relatorio_horarios_empresa ON public.relatorio_horarios_pico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_inativos_empresa ON public.relatorio_clientes_inativos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_relatorio_fidelidade_empresa ON public.relatorio_fidelidade_clientes(empresa_id);

-- ============================================================================
-- PARTE 6: TRIGGERS PARA UPDATED_AT
-- ============================================================================

-- Função genérica para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para comandas (se não existir)
DROP TRIGGER IF EXISTS update_comandas_updated_at ON public.comandas;
CREATE TRIGGER update_comandas_updated_at
  BEFORE UPDATE ON public.comandas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para chat_conversas
DROP TRIGGER IF EXISTS update_chat_conversas_updated_at ON public.chat_conversas;
CREATE TRIGGER update_chat_conversas_updated_at
  BEFORE UPDATE ON public.chat_conversas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PARTE 9: FUNÇÕES RPC ÚTEIS
-- ============================================================================

-- Função para buscar ou criar endereço (evitar duplicatas)
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
  -- Buscar endereço existente
  SELECT id INTO v_endereco_id
  FROM public.enderecos_cliente
  WHERE user_id = p_user_id
    AND rua = p_rua
    AND numero = p_numero
    AND COALESCE(complemento, '') = COALESCE(p_complemento, '')
    AND bairro = p_bairro
  LIMIT 1;
  
  -- Se não existe, criar novo
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

-- Função para definir endereço padrão
CREATE OR REPLACE FUNCTION set_default_address(p_endereco_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Remove o padrão de todos os outros endereços
  UPDATE public.enderecos_cliente
  SET is_default = false
  WHERE user_id = p_user_id;
  
  -- Define o novo padrão
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
  RAISE NOTICE '✅ Sincronização incremental concluída com sucesso!';
  RAISE NOTICE '📊 Colunas adicionadas em tabelas existentes';
  RAISE NOTICE '🆕 11 novas tabelas criadas';
  RAISE NOTICE '🔒 RLS e políticas configuradas';
  RAISE NOTICE '⚡ Índices otimizados criados';
  RAISE NOTICE '🔄 Triggers de updated_at aplicados';
  RAISE NOTICE '🎯 Banco sincronizado com Lovable!';
END$$;
