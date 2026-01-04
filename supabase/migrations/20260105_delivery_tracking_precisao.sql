-- Adicionar coluna 'precisao' na tabela delivery_tracking para armazenar a precisão do GPS
-- e adicionar UNIQUE constraint para permitir upsert por pedido_delivery_id

DO $$
BEGIN
  -- Adicionar coluna precisao se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'delivery_tracking' 
    AND column_name = 'precisao'
  ) THEN
    ALTER TABLE public.delivery_tracking ADD COLUMN precisao DECIMAL(10, 2);
  END IF;

  -- Adicionar constraint UNIQUE no pedido_delivery_id para permitir upsert
  -- Primeiro, remover duplicatas se existirem (manter apenas o mais recente)
  DELETE FROM public.delivery_tracking t1
  WHERE EXISTS (
    SELECT 1 FROM public.delivery_tracking t2
    WHERE t1.pedido_delivery_id = t2.pedido_delivery_id
    AND t1.created_at < t2.created_at
  );
  
  -- Verificar se a constraint já existe antes de criar
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'delivery_tracking_pedido_delivery_id_key'
  ) THEN
    ALTER TABLE public.delivery_tracking 
    ADD CONSTRAINT delivery_tracking_pedido_delivery_id_key 
    UNIQUE (pedido_delivery_id);
  END IF;
END $$;

-- Permitir INSERT e UPDATE para todos os usuários autenticados
DROP POLICY IF EXISTS delivery_tracking_insert ON public.delivery_tracking;
DROP POLICY IF EXISTS delivery_tracking_update ON public.delivery_tracking;

CREATE POLICY delivery_tracking_insert ON public.delivery_tracking
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY delivery_tracking_update ON public.delivery_tracking
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Também permitir select para usuários anônimos (clientes que acompanham pedido)
DROP POLICY IF EXISTS delivery_tracking_select_anon ON public.delivery_tracking;

CREATE POLICY delivery_tracking_select_anon ON public.delivery_tracking
  FOR SELECT TO anon
  USING (true);

COMMENT ON COLUMN public.delivery_tracking.precisao IS 'Precisão do GPS em metros';
