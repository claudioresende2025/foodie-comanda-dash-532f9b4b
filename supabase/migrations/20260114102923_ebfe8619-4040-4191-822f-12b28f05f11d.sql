-- Criar tabela de reembolsos para rastrear solicitações
CREATE TABLE IF NOT EXISTS public.reembolsos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_delivery_id UUID REFERENCES public.pedidos_delivery(id) ON DELETE SET NULL,
  assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pedido', 'assinatura')),
  valor NUMERIC(10,2) NOT NULL,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled')),
  metodo_original TEXT,
  stripe_refund_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de pagamentos de assinatura
CREATE TABLE IF NOT EXISTS public.pagamentos_assinatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  assinatura_id UUID NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metodo_pagamento TEXT,
  descricao TEXT,
  stripe_payment_intent_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar coluna canceled_at em assinaturas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'assinaturas' 
    AND column_name = 'canceled_at'
  ) THEN
    ALTER TABLE public.assinaturas ADD COLUMN canceled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Adicionar colunas em pedidos_delivery se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pedidos_delivery' 
    AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN stripe_payment_intent_id TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pedidos_delivery' 
    AND column_name = 'metodo_pagamento'
  ) THEN
    ALTER TABLE public.pedidos_delivery ADD COLUMN metodo_pagamento TEXT;
  END IF;
END $$;

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.reembolsos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_assinatura ENABLE ROW LEVEL SECURITY;

-- Policies para reembolsos
CREATE POLICY "Empresas podem ver seus reembolsos"
  ON public.reembolsos FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Usuários podem criar solicitações de reembolso"
  ON public.reembolsos FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Policies para pagamentos_assinatura
CREATE POLICY "Empresas podem ver seus pagamentos"
  ON public.pagamentos_assinatura FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_reembolsos_empresa_id ON public.reembolsos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reembolsos_assinatura_id ON public.reembolsos(assinatura_id);
CREATE INDEX IF NOT EXISTS idx_reembolsos_pedido_id ON public.reembolsos(pedido_delivery_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura_empresa_id ON public.pagamentos_assinatura(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura_assinatura_id ON public.pagamentos_assinatura(assinatura_id);