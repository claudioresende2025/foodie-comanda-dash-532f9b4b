-- Criar enum para status de pedido delivery
CREATE TYPE public.delivery_status AS ENUM ('pendente', 'confirmado', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado');

-- Criar enum para forma de pagamento
CREATE TYPE public.forma_pagamento AS ENUM ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito');

-- Tabela de endereços de clientes
CREATE TABLE public.enderecos_cliente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_cliente TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cep TEXT,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'SP',
  referencia TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;

-- Política pública para endereços (clientes não autenticados podem criar/ver próprios)
CREATE POLICY "Public can create enderecos" ON public.enderecos_cliente FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view enderecos" ON public.enderecos_cliente FOR SELECT USING (true);

-- Tabela de pedidos delivery
CREATE TABLE public.pedidos_delivery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  endereco_id UUID NOT NULL REFERENCES public.enderecos_cliente(id),
  status delivery_status NOT NULL DEFAULT 'pendente',
  forma_pagamento forma_pagamento,
  troco_para NUMERIC,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  taxa_entrega NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  stripe_payment_id TEXT,
  stripe_payment_status TEXT,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pedidos_delivery ENABLE ROW LEVEL SECURITY;

-- Políticas para pedidos delivery
CREATE POLICY "Public can create delivery orders" ON public.pedidos_delivery FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view own delivery orders" ON public.pedidos_delivery FOR SELECT USING (true);
CREATE POLICY "Staff can manage delivery orders" ON public.pedidos_delivery FOR ALL USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Tabela de itens do pedido delivery
CREATE TABLE public.itens_delivery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  nome_produto TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.itens_delivery ENABLE ROW LEVEL SECURITY;

-- Políticas para itens delivery
CREATE POLICY "Public can create delivery items" ON public.itens_delivery FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view delivery items" ON public.itens_delivery FOR SELECT USING (true);
CREATE POLICY "Staff can manage delivery items" ON public.itens_delivery FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.pedidos_delivery pd 
    WHERE pd.id = itens_delivery.pedido_delivery_id 
    AND pd.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- Tabela de configurações de delivery por empresa
CREATE TABLE public.config_delivery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE UNIQUE,
  delivery_ativo BOOLEAN NOT NULL DEFAULT false,
  taxa_entrega NUMERIC NOT NULL DEFAULT 0,
  pedido_minimo NUMERIC NOT NULL DEFAULT 0,
  tempo_estimado_min INTEGER NOT NULL DEFAULT 30,
  tempo_estimado_max INTEGER NOT NULL DEFAULT 60,
  raio_entrega_km NUMERIC,
  horario_abertura TIME,
  horario_fechamento TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.config_delivery ENABLE ROW LEVEL SECURITY;

-- Políticas para config delivery
CREATE POLICY "Public can view active delivery config" ON public.config_delivery FOR SELECT USING (delivery_ativo = true);
CREATE POLICY "Staff can manage delivery config" ON public.config_delivery FOR ALL USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Tabela de abertura/fechamento de caixa
CREATE TABLE public.caixas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  valor_abertura NUMERIC NOT NULL DEFAULT 0,
  valor_fechamento NUMERIC,
  data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fechamento TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'aberto',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;

-- Políticas para caixas
CREATE POLICY "Staff can manage caixas" ON public.caixas FOR ALL USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Tabela de movimentações do caixa
CREATE TABLE public.movimentacoes_caixa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caixa_id UUID NOT NULL REFERENCES public.caixas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'entrada' ou 'saida'
  forma_pagamento forma_pagamento,
  valor NUMERIC NOT NULL,
  descricao TEXT,
  comanda_id UUID REFERENCES public.comandas(id),
  pedido_delivery_id UUID REFERENCES public.pedidos_delivery(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

-- Políticas para movimentações
CREATE POLICY "Staff can manage movimentacoes" ON public.movimentacoes_caixa FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.caixas c 
    WHERE c.id = movimentacoes_caixa.caixa_id 
    AND c.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- Tabela de reservas de mesas
CREATE TABLE public.reservas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.mesas(id),
  nome_cliente TEXT NOT NULL,
  telefone_cliente TEXT,
  email_cliente TEXT,
  data_reserva DATE NOT NULL,
  horario_reserva TIME NOT NULL,
  numero_pessoas INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, confirmada, cancelada, concluida
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- Políticas para reservas
CREATE POLICY "Staff can manage reservas" ON public.reservas FOR ALL USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Public can create reservas" ON public.reservas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view own reservas" ON public.reservas FOR SELECT USING (true);

-- Adicionar forma_pagamento à comandas
ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS forma_pagamento forma_pagamento;
ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS troco_para NUMERIC;
ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS data_fechamento TIMESTAMP WITH TIME ZONE;

-- Triggers para updated_at
CREATE TRIGGER update_pedidos_delivery_updated_at BEFORE UPDATE ON public.pedidos_delivery FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_config_delivery_updated_at BEFORE UPDATE ON public.config_delivery FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reservas_updated_at BEFORE UPDATE ON public.reservas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes para performance
CREATE INDEX idx_pedidos_delivery_empresa ON public.pedidos_delivery(empresa_id);
CREATE INDEX idx_pedidos_delivery_status ON public.pedidos_delivery(status);
CREATE INDEX idx_itens_delivery_pedido ON public.itens_delivery(pedido_delivery_id);
CREATE INDEX idx_caixas_empresa ON public.caixas(empresa_id);
CREATE INDEX idx_movimentacoes_caixa ON public.movimentacoes_caixa(caixa_id);
CREATE INDEX idx_reservas_empresa ON public.reservas(empresa_id);
CREATE INDEX idx_reservas_data ON public.reservas(data_reserva);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_delivery;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.caixas;