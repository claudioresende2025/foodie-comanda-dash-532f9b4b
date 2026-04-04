-- Migration: Sistema de Cupons e Ofertas
-- Data: 2026-01-02

-- Tabela de Cupons
CREATE TABLE IF NOT EXISTS public.cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('percentual', 'fixo')),
  valor DECIMAL(10, 2) NOT NULL CHECK (valor > 0),
  valor_minimo DECIMAL(10, 2) DEFAULT 0,
  uso_maximo INTEGER,
  usos_atuais INTEGER DEFAULT 0,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT cupons_empresa_codigo_unique UNIQUE (empresa_id, codigo),
  CONSTRAINT cupons_datas_validas CHECK (data_fim >= data_inicio)
);

-- Índices para Cupons
CREATE INDEX IF NOT EXISTS idx_cupons_empresa_id ON public.cupons(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON public.cupons(codigo);
CREATE INDEX IF NOT EXISTS idx_cupons_ativo ON public.cupons(ativo);
CREATE INDEX IF NOT EXISTS idx_cupons_datas ON public.cupons(data_inicio, data_fim);

-- Tabela de Ofertas
CREATE TABLE IF NOT EXISTS public.ofertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  preco_original DECIMAL(10, 2) NOT NULL CHECK (preco_original > 0),
  preco_oferta DECIMAL(10, 2) NOT NULL CHECK (preco_oferta > 0),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT ofertas_preco_valido CHECK (preco_oferta < preco_original),
  CONSTRAINT ofertas_datas_validas CHECK (data_fim >= data_inicio)
);

-- Índices para Ofertas
CREATE INDEX IF NOT EXISTS idx_ofertas_empresa_id ON public.ofertas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_produto_id ON public.ofertas(produto_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_ativa ON public.ofertas(ativa);
CREATE INDEX IF NOT EXISTS idx_ofertas_datas ON public.ofertas(data_inicio, data_fim);

-- Trigger para updated_at em cupons
CREATE OR REPLACE FUNCTION update_cupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cupons_updated_at
BEFORE UPDATE ON public.cupons
FOR EACH ROW
EXECUTE FUNCTION update_cupons_updated_at();

-- Trigger para updated_at em ofertas
CREATE OR REPLACE FUNCTION update_ofertas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ofertas_updated_at
BEFORE UPDATE ON public.ofertas
FOR EACH ROW
EXECUTE FUNCTION update_ofertas_updated_at();

-- RLS (Row Level Security) para Cupons
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários autenticados podem ver cupons da sua empresa
CREATE POLICY "Users can view cupons of their empresa"
  ON public.cupons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.empresa_id = cupons.empresa_id
    )
  );

-- Policy: Usuários podem criar cupons na sua empresa
CREATE POLICY "Users can insert cupons in their empresa"
  ON public.cupons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.empresa_id = cupons.empresa_id
    )
  );

-- Policy: Usuários podem atualizar cupons da sua empresa
CREATE POLICY "Users can update cupons of their empresa"
  ON public.cupons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.empresa_id = cupons.empresa_id
    )
  );

-- Policy: Usuários podem deletar cupons da sua empresa
CREATE POLICY "Users can delete cupons of their empresa"
  ON public.cupons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.empresa_id = cupons.empresa_id
    )
  );

-- RLS para Ofertas
ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários autenticados podem ver ofertas da sua empresa
CREATE POLICY "Users can view ofertas of their empresa"
  ON public.ofertas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.empresa_id = ofertas.empresa_id
    )
  );

-- Policy: Usuários podem criar ofertas na sua empresa
CREATE POLICY "Users can insert ofertas in their empresa"
  ON public.ofertas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.empresa_id = ofertas.empresa_id
    )
  );

-- Policy: Usuários podem atualizar ofertas da sua empresa
CREATE POLICY "Users can update ofertas of their empresa"
  ON public.ofertas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.empresa_id = ofertas.empresa_id
    )
  );

-- Policy: Usuários podem deletar ofertas da sua empresa
CREATE POLICY "Users can delete ofertas of their empresa"
  ON public.ofertas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.empresa_id = ofertas.empresa_id
    )
  );

-- Função para validar cupom
CREATE OR REPLACE FUNCTION validar_cupom(
  p_codigo VARCHAR,
  p_empresa_id UUID,
  p_subtotal DECIMAL,
  p_produto_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_cupom RECORD;
  v_desconto DECIMAL;
  v_resultado JSON;
BEGIN
  -- Buscar cupom
  SELECT * INTO v_cupom
  FROM public.cupons
  WHERE codigo = p_codigo
    AND empresa_id = p_empresa_id
    AND ativo = true
    AND CURRENT_DATE BETWEEN data_inicio AND data_fim;

  -- Cupom não encontrado ou inválido
  IF NOT FOUND THEN
    RETURN json_build_object(
      'valido', false,
      'mensagem', 'Cupom inválido ou expirado'
    );
  END IF;

  -- Verificar uso máximo
  IF v_cupom.uso_maximo IS NOT NULL AND v_cupom.usos_atuais >= v_cupom.uso_maximo THEN
    RETURN json_build_object(
      'valido', false,
      'mensagem', 'Cupom esgotado'
    );
  END IF;

  -- Verificar valor mínimo
  IF v_cupom.valor_minimo IS NOT NULL AND p_subtotal < v_cupom.valor_minimo THEN
    RETURN json_build_object(
      'valido', false,
      'mensagem', 'Valor mínimo de R$ ' || v_cupom.valor_minimo || ' não atingido'
    );
  END IF;

  -- Verificar produto específico
  IF v_cupom.produto_id IS NOT NULL AND (p_produto_id IS NULL OR v_cupom.produto_id != p_produto_id) THEN
    RETURN json_build_object(
      'valido', false,
      'mensagem', 'Cupom válido apenas para produto específico'
    );
  END IF;

  -- Calcular desconto
  IF v_cupom.tipo = 'percentual' THEN
    v_desconto := (p_subtotal * v_cupom.valor / 100);
  ELSE
    v_desconto := v_cupom.valor;
  END IF;

  -- Não permitir desconto maior que o subtotal
  IF v_desconto > p_subtotal THEN
    v_desconto := p_subtotal;
  END IF;

  -- Retornar resultado
  RETURN json_build_object(
    'valido', true,
    'mensagem', 'Cupom aplicado com sucesso!',
    'cupom_id', v_cupom.id,
    'valor_desconto', v_desconto,
    'tipo', v_cupom.tipo,
    'valor', v_cupom.valor
  );
END;
$$ LANGUAGE plpgsql;

-- Função para registrar uso de cupom
CREATE OR REPLACE FUNCTION registrar_uso_cupom(p_cupom_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.cupons
  SET usos_atuais = usos_atuais + 1,
      updated_at = now()
  WHERE id = p_cupom_id;
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE public.cupons IS 'Cupons de desconto para marketing';
COMMENT ON TABLE public.ofertas IS 'Ofertas especiais de produtos';
COMMENT ON FUNCTION validar_cupom IS 'Valida um cupom e retorna o desconto aplicável';
COMMENT ON FUNCTION registrar_uso_cupom IS 'Incrementa o contador de uso de um cupom';
