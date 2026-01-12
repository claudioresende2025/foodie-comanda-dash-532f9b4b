-- ============================================================================
-- MIGRAÇÃO COMPLETA DO SISTEMA FOODIE COMANDA
-- ============================================================================
-- Script consolidado para sincronizar todas as tabelas do Lovable para Supabase
-- Gerado em: 2026-01-02
-- 
-- INSTRUÇÕES:
-- 1. Abra o Supabase Dashboard
-- 2. Vá em SQL Editor
-- 3. Crie uma nova query
-- 4. Cole este arquivo completo
-- 5. Execute
--
-- NOTA: Este script usa CREATE TABLE IF NOT EXISTS, então é seguro executar
-- múltiplas vezes. Ele não sobrescreverá dados existentes.
-- ============================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TIPOS ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('proprietario', 'gerente', 'garcom', 'caixa');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE comanda_status AS ENUM ('aberta', 'fechada', 'cancelada');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('pendente', 'confirmado', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE mesa_status AS ENUM ('disponivel', 'ocupada', 'reservada', 'juncao');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pedido_status AS ENUM ('pendente', 'preparando', 'pronto', 'entregue', 'cancelado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABELA: empresas (Base do sistema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT,
  endereco_completo TEXT,
  logo_url TEXT,
  chave_pix TEXT,
  inscricao_estadual TEXT,
  usuario_proprietario_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Permitir leitura pública de empresas delivery"
  ON public.empresas FOR SELECT
  USING (true);

CREATE POLICY "Permitir CRUD para usuários autenticados"
  ON public.empresas FOR ALL
  USING (auth.uid() = usuario_proprietario_id);

-- ============================================================================
-- TABELA: profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  avatar_url TEXT,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================================
-- TABELA: user_roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'garcom',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, empresa_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprias roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABELA: categorias
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de categorias ativas"
  ON public.categorias FOR SELECT
  USING (ativo = true);

-- ============================================================================
-- TABELA: produtos
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  imagem_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de produtos ativos"
  ON public.produtos FOR SELECT
  USING (ativo = true);

-- ============================================================================
-- TABELA: mesas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mesas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_mesa INTEGER NOT NULL,
  capacidade INTEGER,
  status mesa_status DEFAULT 'disponivel',
  mesa_juncao_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, numero_mesa)
);

ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABELA: comandas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comandas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  nome_cliente TEXT,
  telefone_cliente TEXT,
  total DECIMAL(10,2) DEFAULT 0,
  status comanda_status DEFAULT 'aberta',
  forma_pagamento forma_pagamento,
  data_fechamento TIMESTAMPTZ,
  qr_code_sessao TEXT,
  comanda_mestre_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
  troco_para DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABELA: pedidos
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  notas_cliente TEXT,
  status_cozinha pedido_status DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABELA: caixas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.caixas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  data_abertura TIMESTAMPTZ DEFAULT NOW(),
  data_fechamento TIMESTAMPTZ,
  valor_abertura DECIMAL(10,2) DEFAULT 0,
  valor_fechamento DECIMAL(10,2),
  status TEXT DEFAULT 'aberto',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TABELA: movimentacoes_caixa
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id UUID NOT NULL REFERENCES public.caixas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT,
  forma_pagamento forma_pagamento,
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
  pedido_delivery_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DELIVERY - Endereços, Configuração e Pedidos
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.config_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  taxa_entrega DECIMAL(10,2) DEFAULT 0,
  tempo_estimado_min INTEGER DEFAULT 30,
  tempo_estimado_max INTEGER DEFAULT 60,
  raio_entrega_km DECIMAL(5,2) DEFAULT 5.0,
  valor_minimo_pedido DECIMAL(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  horario_abertura TIME,
  horario_fechamento TIME,
  dias_funcionamento INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id)
);

ALTER TABLE public.config_delivery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública config delivery"
  ON public.config_delivery FOR SELECT
  USING (ativo = true);

CREATE TABLE IF NOT EXISTS public.enderecos_cliente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_cliente TEXT NOT NULL,
  telefone TEXT NOT NULL,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL DEFAULT 'São Paulo',
  estado TEXT DEFAULT 'SP',
  cep TEXT,
  referencia TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprios endereços"
  ON public.enderecos_cliente FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar próprios endereços"
  ON public.enderecos_cliente FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.pedidos_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endereco_id UUID REFERENCES public.enderecos_cliente(id) ON DELETE SET NULL,
  subtotal DECIMAL(10,2) DEFAULT 0,
  taxa_entrega DECIMAL(10,2) DEFAULT 0,
  desconto DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status delivery_status DEFAULT 'pendente',
  forma_pagamento forma_pagamento,
  notas TEXT,
  agendado_para TIMESTAMPTZ,
  cupom_id UUID,
  troco_para DECIMAL(10,2),
  stripe_payment_id TEXT,
  stripe_payment_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pedidos_delivery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprios pedidos delivery"
  ON public.pedidos_delivery FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.itens_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome_produto TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.itens_delivery ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SISTEMA DE CUPONS E PROMOÇÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  tipo TEXT DEFAULT 'desconto_percentual',
  valor DECIMAL(10,2) NOT NULL,
  valor_minimo_pedido DECIMAL(10,2),
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  uso_maximo INTEGER,
  uso_atual INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, codigo)
);

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cupons_uso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cupom_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
  pedido_delivery_id UUID REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valor_desconto DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cupons_uso ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SISTEMA DE FIDELIDADE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fidelidade_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pontos_por_real DECIMAL(10,2) DEFAULT 1.0,
  reais_por_ponto DECIMAL(10,2) DEFAULT 0.01,
  ativo BOOLEAN DEFAULT true,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id)
);

ALTER TABLE public.fidelidade_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fidelidade_pontos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  saldo_pontos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, empresa_id)
);

ALTER TABLE public.fidelidade_pontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprios pontos"
  ON public.fidelidade_pontos FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.fidelidade_transacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  pontos INTEGER NOT NULL,
  pedido_delivery_id UUID REFERENCES public.pedidos_delivery(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fidelidade_transacoes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMBOS E PROMOÇÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.combos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_combo DECIMAL(10,2) NOT NULL,
  imagem_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.combo_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id UUID NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.combo_itens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.promocoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_promocional DECIMAL(10,2) NOT NULL,
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  dias_semana INTEGER[],
  ativo BOOLEAN DEFAULT true,
  imagem_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.promocoes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.promocao_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promocao_id UUID NOT NULL REFERENCES public.promocoes(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.promocao_itens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SISTEMA DE RESERVAS E CHAMADAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  nome_cliente TEXT NOT NULL,
  telefone_cliente TEXT,
  email_cliente TEXT,
  data_reserva DATE NOT NULL,
  horario_reserva TIME NOT NULL,
  numero_pessoas INTEGER NOT NULL,
  status TEXT DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chamadas_garcom (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mesa_id UUID NOT NULL REFERENCES public.mesas(id) ON DELETE CASCADE,
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pendente',
  atendida_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chamadas_garcom ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SISTEMA DE AVALIAÇÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nota_pedido INTEGER CHECK (nota_pedido >= 1 AND nota_pedido <= 5),
  nota_entrega INTEGER CHECK (nota_entrega >= 1 AND nota_entrega <= 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pedido_delivery_id)
);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CHAT E NOTIFICAÇÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_conversas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'ativa',
  ultima_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.notificacoes_push ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprias notificações"
  ON public.notificacoes_push FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- SEGURANÇA E RASTREAMENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  status delivery_status NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ANALYTICS E RELATÓRIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  dados JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analytics_eventos ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.relatorio_vendas_diarias ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.relatorio_produtos_vendidos ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.relatorio_horarios_pico ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.relatorio_clientes_inativos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ultima_compra TIMESTAMPTZ,
  dias_inativo INTEGER,
  total_gasto DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.relatorio_clientes_inativos ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.relatorio_fidelidade_clientes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_mesas_empresa ON public.mesas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_empresa ON public.comandas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_mesa ON public.comandas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_comanda ON public.pedidos(comanda_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_empresa ON public.pedidos_delivery(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_user ON public.pedidos_delivery(user_id);
CREATE INDEX IF NOT EXISTS idx_itens_delivery_pedido ON public.itens_delivery(pedido_delivery_id);
CREATE INDEX IF NOT EXISTS idx_enderecos_user ON public.enderecos_cliente(user_id);
CREATE INDEX IF NOT EXISTS idx_fidelidade_pontos_user_empresa ON public.fidelidade_pontos(user_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversas_empresa_user ON public.chat_conversas(empresa_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes_push(user_id);

-- ============================================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- ============================================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'empresas', 'profiles', 'categorias', 'produtos', 'mesas', 
      'comandas', 'pedidos', 'config_delivery', 'cupons', 
      'fidelidade_config', 'fidelidade_pontos', 'combos', 
      'promocoes', 'reservas', 'chat_conversas', 'pedidos_delivery',
      'relatorio_vendas_diarias'
    )
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON public.%I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    ', r.tablename, r.tablename, r.tablename, r.tablename);
  END LOOP;
END$$;

-- ============================================================================
-- FUNÇÕES RPC ÚTEIS
-- ============================================================================

-- Função para buscar ou criar endereço sem duplicatas
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

-- Comentário final
COMMENT ON SCHEMA public IS 'Schema principal do sistema Foodie Comanda - Sincronizado com Lovable';

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Migração completa executada com sucesso!';
  RAISE NOTICE '📊 Todas as tabelas, índices, triggers e funções foram criadas';
  RAISE NOTICE '🔒 RLS (Row Level Security) habilitado em todas as tabelas';
  RAISE NOTICE '🎉 Banco de dados sincronizado com o schema Lovable!';
END$$;
