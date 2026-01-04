-- ============================================
-- SISTEMA DE ASSINATURAS E TRIAL
-- ============================================

-- 1. Enum para status de assinatura
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM (
      'trialing',      -- Em período de teste
      'active',        -- Assinatura ativa
      'past_due',      -- Pagamento atrasado
      'canceled',      -- Cancelada
      'unpaid',        -- Não pago
      'paused'         -- Pausada
    );
  END IF;
END $$;

-- 2. Enum para status de reembolso
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
    CREATE TYPE refund_status AS ENUM (
      'pending',       -- Pendente
      'processing',    -- Processando
      'succeeded',     -- Concluído
      'failed',        -- Falhou
      'canceled'       -- Cancelado
    );
  END IF;
END $$;

-- 3. Tabela de Planos
CREATE TABLE IF NOT EXISTS public.planos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  preco_mensal DECIMAL(10, 2) NOT NULL,
  preco_anual DECIMAL(10, 2),
  stripe_price_id_mensal VARCHAR(255),
  stripe_price_id_anual VARCHAR(255),
  recursos JSONB DEFAULT '[]'::jsonb,
  limite_pedidos_mes INTEGER, -- NULL = ilimitado
  limite_mesas INTEGER,
  limite_usuarios INTEGER,
  destaque BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Assinaturas
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES public.planos(id),
  status subscription_status DEFAULT 'trialing',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  periodo VARCHAR(20) DEFAULT 'mensal', -- mensal ou anual
  trial_start TIMESTAMPTZ DEFAULT NOW(),
  trial_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id)
);

-- 5. Tabela de Histórico de Pagamentos
CREATE TABLE IF NOT EXISTS public.pagamentos_assinatura (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  valor DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  metodo_pagamento VARCHAR(50), -- card, pix, boleto
  descricao TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Reembolsos
CREATE TABLE IF NOT EXISTS public.reembolsos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  pedido_delivery_id UUID REFERENCES public.pedidos_delivery(id) ON DELETE SET NULL,
  assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  tipo VARCHAR(50) NOT NULL, -- 'pedido' ou 'assinatura'
  valor DECIMAL(10, 2) NOT NULL,
  motivo TEXT,
  status refund_status DEFAULT 'pending',
  stripe_refund_id VARCHAR(255),
  metodo_original VARCHAR(50), -- card, pix
  dados_reembolso JSONB, -- Para PIX: chave, banco, etc
  processado_por UUID REFERENCES auth.users(id),
  processado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela de Configurações do Sistema (Super Admin)
CREATE TABLE IF NOT EXISTS public.config_sistema (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT,
  tipo VARCHAR(50) DEFAULT 'string', -- string, number, boolean, json
  descricao TEXT,
  grupo VARCHAR(50), -- stripe, pix, geral
  editavel BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela de Super Admins (desenvolvedores)
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(255),
  email VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  permissoes JSONB DEFAULT '["all"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 9. Tabela de Logs de Auditoria (Super Admin)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  acao VARCHAR(100) NOT NULL,
  tabela VARCHAR(100),
  registro_id UUID,
  dados_antigos JSONB,
  dados_novos JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INSERIR PLANOS PADRÃO
-- ============================================

INSERT INTO public.planos (nome, descricao, preco_mensal, preco_anual, recursos, limite_pedidos_mes, limite_mesas, limite_usuarios, destaque, ordem)
VALUES 
  (
    'Básico',
    'Ideal para pequenos restaurantes começando no delivery',
    79.90,
    799.00,
    '["Até 100 pedidos/mês", "5 mesas", "2 usuários", "Cardápio digital", "Pedidos delivery", "Suporte por email"]'::jsonb,
    100,
    5,
    2,
    false,
    1
  ),
  (
    'Profissional',
    'Para restaurantes em crescimento',
    149.90,
    1499.00,
    '["Até 500 pedidos/mês", "20 mesas", "5 usuários", "Cardápio digital", "Pedidos delivery", "Comandas digitais", "Relatórios avançados", "Integração PIX", "Suporte prioritário"]'::jsonb,
    500,
    20,
    5,
    true,
    2
  ),
  (
    'Enterprise',
    'Para redes e grandes operações',
    299.90,
    2999.00,
    '["Pedidos ilimitados", "Mesas ilimitadas", "Usuários ilimitados", "Todas as funcionalidades", "API personalizada", "Suporte 24/7", "Gerente de conta dedicado", "Treinamento incluso"]'::jsonb,
    NULL,
    NULL,
    NULL,
    false,
    3
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- INSERIR CONFIGURAÇÕES PADRÃO
-- ============================================

INSERT INTO public.config_sistema (chave, valor, tipo, descricao, grupo)
VALUES
  ('stripe_public_key', '', 'string', 'Chave pública do Stripe', 'stripe'),
  ('stripe_secret_key', '', 'string', 'Chave secreta do Stripe (armazenada em secrets)', 'stripe'),
  ('stripe_webhook_secret', '', 'string', 'Secret do Webhook Stripe', 'stripe'),
  ('trial_days', '3', 'number', 'Dias de trial gratuito', 'geral'),
  ('pix_chave', '', 'string', 'Chave PIX para recebimentos', 'pix'),
  ('pix_tipo', 'cpf', 'string', 'Tipo da chave PIX (cpf, cnpj, email, telefone, aleatoria)', 'pix'),
  ('pix_nome', '', 'string', 'Nome do recebedor PIX', 'pix'),
  ('banco_codigo', '', 'string', 'Código do banco', 'pix'),
  ('banco_agencia', '', 'string', 'Agência bancária', 'pix'),
  ('banco_conta', '', 'string', 'Número da conta', 'pix'),
  ('taxa_plataforma_percentual', '0', 'number', 'Taxa percentual sobre vendas (%)', 'geral'),
  ('email_suporte', '', 'string', 'Email de suporte', 'geral'),
  ('whatsapp_suporte', '', 'string', 'WhatsApp de suporte', 'geral')
ON CONFLICT (chave) DO NOTHING;

-- ============================================
-- ATUALIZAR TABELA EMPRESAS
-- ============================================

-- Adicionar campos de trial/assinatura na tabela empresas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'empresas' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE public.empresas ADD COLUMN trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'empresas' AND column_name = 'subscription_status') THEN
    ALTER TABLE public.empresas ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'trialing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'empresas' AND column_name = 'blocked_at') THEN
    ALTER TABLE public.empresas ADD COLUMN blocked_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'empresas' AND column_name = 'block_reason') THEN
    ALTER TABLE public.empresas ADD COLUMN block_reason TEXT;
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_assinatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reembolsos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Planos: Todos podem ver (público)
DROP POLICY IF EXISTS planos_select ON public.planos;
CREATE POLICY planos_select ON public.planos
  FOR SELECT USING (ativo = true);

-- Planos: Super admins podem tudo
DROP POLICY IF EXISTS planos_super_admin ON public.planos;
CREATE POLICY planos_super_admin ON public.planos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- Assinaturas: Empresa vê sua própria
DROP POLICY IF EXISTS assinaturas_select ON public.assinaturas;
CREATE POLICY assinaturas_select ON public.assinaturas
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- Assinaturas: Super admin pode tudo
DROP POLICY IF EXISTS assinaturas_super_admin ON public.assinaturas;
CREATE POLICY assinaturas_super_admin ON public.assinaturas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- Pagamentos: Empresa vê seus próprios
DROP POLICY IF EXISTS pagamentos_assinatura_select ON public.pagamentos_assinatura;
CREATE POLICY pagamentos_assinatura_select ON public.pagamentos_assinatura
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- Reembolsos: Empresa vê seus próprios
DROP POLICY IF EXISTS reembolsos_select ON public.reembolsos;
CREATE POLICY reembolsos_select ON public.reembolsos
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- Reembolsos: Super admin pode tudo
DROP POLICY IF EXISTS reembolsos_super_admin ON public.reembolsos;
CREATE POLICY reembolsos_super_admin ON public.reembolsos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- Config Sistema: Apenas super admins
DROP POLICY IF EXISTS config_sistema_super_admin ON public.config_sistema;
CREATE POLICY config_sistema_super_admin ON public.config_sistema
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- Super Admins: Apenas super admins veem
DROP POLICY IF EXISTS super_admins_select ON public.super_admins;
CREATE POLICY super_admins_select ON public.super_admins
  FOR SELECT USING (
    user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- Audit Logs: Apenas super admins
DROP POLICY IF EXISTS audit_logs_super_admin ON public.audit_logs;
CREATE POLICY audit_logs_super_admin ON public.audit_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid() AND ativo = true)
  );

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_assinaturas_empresa ON public.assinaturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON public.assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_customer ON public.assinaturas(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_subscription ON public.assinaturas(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_empresa ON public.pagamentos_assinatura(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura ON public.pagamentos_assinatura(assinatura_id);
CREATE INDEX IF NOT EXISTS idx_reembolsos_empresa ON public.reembolsos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reembolsos_status ON public.reembolsos(status);
CREATE INDEX IF NOT EXISTS idx_config_sistema_grupo ON public.config_sistema(grupo);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acao ON public.audit_logs(acao);
CREATE INDEX IF NOT EXISTS idx_empresas_trial ON public.empresas(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_empresas_subscription_status ON public.empresas(subscription_status);

-- ============================================
-- FUNÇÃO PARA VERIFICAR SE EMPRESA ESTÁ BLOQUEADA
-- ============================================

CREATE OR REPLACE FUNCTION public.check_empresa_blocked(p_empresa_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_empresa RECORD;
  v_assinatura RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('blocked', true, 'reason', 'Empresa não encontrada');
  END IF;
  
  -- Verificar se está explicitamente bloqueada
  IF v_empresa.blocked_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'blocked', true, 
      'reason', COALESCE(v_empresa.block_reason, 'Conta bloqueada'),
      'blocked_at', v_empresa.blocked_at
    );
  END IF;
  
  -- Buscar assinatura
  SELECT * INTO v_assinatura FROM public.assinaturas WHERE empresa_id = p_empresa_id;
  
  -- Se não tem assinatura, verificar trial da empresa
  IF NOT FOUND THEN
    IF v_empresa.trial_ends_at IS NOT NULL AND v_empresa.trial_ends_at < NOW() THEN
      RETURN jsonb_build_object(
        'blocked', true,
        'reason', 'Período de teste expirado',
        'trial_ended_at', v_empresa.trial_ends_at
      );
    END IF;
    
    -- Ainda no trial
    RETURN jsonb_build_object(
      'blocked', false,
      'status', 'trialing',
      'trial_ends_at', v_empresa.trial_ends_at,
      'days_remaining', GREATEST(0, EXTRACT(DAY FROM v_empresa.trial_ends_at - NOW()))
    );
  END IF;
  
  -- Verificar status da assinatura
  IF v_assinatura.status = 'active' THEN
    RETURN jsonb_build_object(
      'blocked', false,
      'status', 'active',
      'current_period_end', v_assinatura.current_period_end
    );
  ELSIF v_assinatura.status = 'trialing' THEN
    IF v_assinatura.trial_end < NOW() THEN
      RETURN jsonb_build_object(
        'blocked', true,
        'reason', 'Período de teste expirado',
        'trial_ended_at', v_assinatura.trial_end
      );
    END IF;
    RETURN jsonb_build_object(
      'blocked', false,
      'status', 'trialing',
      'trial_ends_at', v_assinatura.trial_end,
      'days_remaining', GREATEST(0, EXTRACT(DAY FROM v_assinatura.trial_end - NOW()))
    );
  ELSIF v_assinatura.status IN ('canceled', 'unpaid', 'past_due') THEN
    RETURN jsonb_build_object(
      'blocked', true,
      'reason', CASE v_assinatura.status 
        WHEN 'canceled' THEN 'Assinatura cancelada'
        WHEN 'unpaid' THEN 'Pagamento pendente'
        WHEN 'past_due' THEN 'Pagamento atrasado'
      END,
      'status', v_assinatura.status
    );
  END IF;
  
  RETURN jsonb_build_object('blocked', false, 'status', v_assinatura.status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÃO PARA CRIAR ASSINATURA DE TRIAL
-- ============================================

CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar assinatura de trial automaticamente quando empresa é criada
  INSERT INTO public.assinaturas (empresa_id, status, trial_start, trial_end)
  VALUES (NEW.id, 'trialing', NOW(), NOW() + INTERVAL '3 days')
  ON CONFLICT (empresa_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar trial automaticamente
DROP TRIGGER IF EXISTS trigger_create_trial ON public.empresas;
CREATE TRIGGER trigger_create_trial
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trial_subscription();

-- ============================================
-- FUNÇÃO PARA VERIFICAR SE USUÁRIO É SUPER ADMIN
-- ============================================

CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = p_user_id AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.planos IS 'Planos de assinatura disponíveis';
COMMENT ON TABLE public.assinaturas IS 'Assinaturas das empresas';
COMMENT ON TABLE public.pagamentos_assinatura IS 'Histórico de pagamentos de assinaturas';
COMMENT ON TABLE public.reembolsos IS 'Solicitações de reembolso (pedidos ou assinaturas)';
COMMENT ON TABLE public.config_sistema IS 'Configurações globais do sistema (Stripe, PIX, etc)';
COMMENT ON TABLE public.super_admins IS 'Usuários com acesso de super administrador';
COMMENT ON TABLE public.audit_logs IS 'Logs de auditoria para ações importantes';
