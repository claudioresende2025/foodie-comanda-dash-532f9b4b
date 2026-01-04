-- Criar tabela para rastrear localização do entregador
CREATE TABLE public.delivery_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_delivery_id UUID NOT NULL REFERENCES public.pedidos_delivery(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  precisao DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índice para busca rápida por pedido
CREATE INDEX idx_delivery_locations_pedido ON public.delivery_locations(pedido_delivery_id);

-- Habilitar RLS
ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;

-- Política para clientes verem localização dos seus pedidos
CREATE POLICY "Clientes podem ver localização dos seus pedidos"
ON public.delivery_locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos_delivery pd
    WHERE pd.id = delivery_locations.pedido_delivery_id
    AND pd.user_id = auth.uid()
  )
);

-- Política para funcionários da empresa atualizarem localização
CREATE POLICY "Funcionários podem gerenciar localizações da empresa"
ON public.delivery_locations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos_delivery pd
    JOIN public.user_roles ur ON ur.empresa_id = pd.empresa_id
    WHERE pd.id = delivery_locations.pedido_delivery_id
    AND ur.user_id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_delivery_locations_updated_at
BEFORE UPDATE ON public.delivery_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_locations;