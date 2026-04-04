-- Migration: Cria tabela vendas_concluidas e adiciona status aguardando_pagamento
-- Sistema de registro financeiro para tracking de pagamentos

-- 1. Adicionar novo valor ao enum mesa_status se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'aguardando_pagamento' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'mesa_status')) THEN
    ALTER TYPE mesa_status ADD VALUE 'aguardando_pagamento';
  END IF;
END$$;

-- 2. Criar tabela vendas_concluidas para registro financeiro
CREATE TABLE IF NOT EXISTS vendas_concluidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  comanda_id UUID REFERENCES comandas(id) ON DELETE SET NULL,
  mesa_id UUID REFERENCES mesas(id) ON DELETE SET NULL,
  
  -- Dados do pagamento
  valor_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_desconto DECIMAL(10,2) DEFAULT 0,
  valor_taxa_servico DECIMAL(10,2) DEFAULT 0,
  valor_couver DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) NOT NULL,
  
  -- Método de pagamento
  forma_pagamento VARCHAR(50) NOT NULL, -- dinheiro, pix, cartao_credito, cartao_debito, multiplo
  formas_pagamento_detalhes JSONB, -- detalhes para pagamento múltiplo
  troco_para DECIMAL(10,2),
  
  -- Quem processou
  processado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tipo_processamento VARCHAR(20) DEFAULT 'caixa', -- caixa, garcom
  observacao TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  CONSTRAINT fk_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vendas_concluidas_empresa ON vendas_concluidas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_concluidas_data ON vendas_concluidas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_concluidas_forma_pagamento ON vendas_concluidas(forma_pagamento);

-- RLS
ALTER TABLE vendas_concluidas ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver vendas da própria empresa
CREATE POLICY "Usuarios podem ver vendas da empresa"
  ON vendas_concluidas
  FOR SELECT
  USING (empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid()));

-- Política: usuários podem inserir vendas na própria empresa
CREATE POLICY "Usuarios podem inserir vendas"
  ON vendas_concluidas
  FOR INSERT
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid()));

-- Comentários
COMMENT ON TABLE vendas_concluidas IS 'Registro financeiro de todas as vendas concluídas para relatórios';
COMMENT ON COLUMN vendas_concluidas.tipo_processamento IS 'caixa = fechado pelo caixa, garcom = "dar baixa" pelo garçom';
