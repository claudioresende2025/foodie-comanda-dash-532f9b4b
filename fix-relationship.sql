
-- Remover constraint antiga se existir
ALTER TABLE IF EXISTS public.itens_delivery 
  DROP CONSTRAINT IF EXISTS itens_delivery_pedido_delivery_id_fkey;

-- Adicionar constraint com nome explícito
ALTER TABLE public.itens_delivery 
  ADD CONSTRAINT itens_delivery_pedido_delivery_id_fkey 
  FOREIGN KEY (pedido_delivery_id) 
  REFERENCES public.pedidos_delivery(id) 
  ON DELETE CASCADE;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_itens_delivery_pedido_id 
  ON public.itens_delivery(pedido_delivery_id);
