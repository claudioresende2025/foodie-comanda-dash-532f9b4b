-- =====================================================
-- CRIAR TABELA PARA LOCALIZAÇÃO GLOBAL DO ENTREGADOR
-- Data: 2026-03-12
-- Permite que o entregador compartilhe GPS para múltiplas entregas
-- =====================================================

-- Criar tabela para rastrear localização do entregador (independente do pedido)
CREATE TABLE IF NOT EXISTS public.entregador_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  precisao DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Um entregador por empresa
  CONSTRAINT entregador_locations_user_empresa_unique UNIQUE (user_id, empresa_id)
);

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_entregador_locations_user ON public.entregador_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_entregador_locations_empresa ON public.entregador_locations(empresa_id);
CREATE INDEX IF NOT EXISTS idx_entregador_locations_active ON public.entregador_locations(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.entregador_locations ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "entregador_locations_select_all" ON public.entregador_locations;
DROP POLICY IF EXISTS "entregador_locations_insert" ON public.entregador_locations;
DROP POLICY IF EXISTS "entregador_locations_update" ON public.entregador_locations;
DROP POLICY IF EXISTS "entregador_locations_delete" ON public.entregador_locations;

-- Política para SELECT público (clientes precisam ver localização do entregador)
CREATE POLICY "entregador_locations_select_all"
ON public.entregador_locations
FOR SELECT
USING (true);

-- Política para INSERT (usuários autenticados podem inserir sua localização)
CREATE POLICY "entregador_locations_insert"
ON public.entregador_locations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política para UPDATE (usuários autenticados podem atualizar sua localização)
CREATE POLICY "entregador_locations_update"
ON public.entregador_locations
FOR UPDATE
USING (auth.uid() = user_id);

-- Política para DELETE (usuários autenticados podem deletar sua localização)
CREATE POLICY "entregador_locations_delete"
ON public.entregador_locations
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_entregador_locations_updated_at
BEFORE UPDATE ON public.entregador_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.entregador_locations;

-- Grants
GRANT SELECT ON public.entregador_locations TO anon;
GRANT SELECT ON public.entregador_locations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.entregador_locations TO authenticated;

-- =====================================================
-- ADICIONAR COLUNA entregador_id NA TABELA pedidos_delivery
-- Para saber qual entregador está fazendo a entrega
-- =====================================================

-- Adicionar coluna se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pedidos_delivery' 
        AND column_name = 'entregador_id'
    ) THEN
        ALTER TABLE public.pedidos_delivery 
        ADD COLUMN entregador_id UUID REFERENCES auth.users(id);
        
        CREATE INDEX idx_pedidos_delivery_entregador ON public.pedidos_delivery(entregador_id);
        
        RAISE NOTICE 'Coluna entregador_id adicionada em pedidos_delivery';
    ELSE
        RAISE NOTICE 'Coluna entregador_id já existe em pedidos_delivery';
    END IF;
END
$$;

-- =====================================================
-- FUNÇÃO PARA SINCRONIZAR LOCALIZAÇÃO DO ENTREGADOR
-- COM TODOS OS PEDIDOS EM ENTREGA
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_entregador_location_to_pedidos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Quando a localização do entregador é atualizada,
    -- sincronizar para todos os pedidos dele que estão "saiu_entrega"
    
    IF NEW.is_active THEN
        -- Atualizar ou inserir localização em delivery_locations para cada pedido ativo
        INSERT INTO delivery_locations (pedido_delivery_id, latitude, longitude, precisao, updated_at)
        SELECT 
            pd.id,
            NEW.latitude,
            NEW.longitude,
            NEW.precisao,
            NOW()
        FROM pedidos_delivery pd
        WHERE pd.entregador_id = NEW.user_id
        AND pd.empresa_id = NEW.empresa_id
        AND pd.status = 'saiu_entrega'
        ON CONFLICT (pedido_delivery_id) 
        DO UPDATE SET 
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            precisao = EXCLUDED.precisao,
            updated_at = EXCLUDED.updated_at;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger para sincronização automática
DROP TRIGGER IF EXISTS sync_entregador_location_trigger ON public.entregador_locations;
CREATE TRIGGER sync_entregador_location_trigger
AFTER INSERT OR UPDATE ON public.entregador_locations
FOR EACH ROW
EXECUTE FUNCTION public.sync_entregador_location_to_pedidos();

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Tabela entregador_locations criada com sucesso';
    RAISE NOTICE '✅ Políticas RLS configuradas';
    RAISE NOTICE '✅ Trigger de sincronização criado';
    RAISE NOTICE '✅ Coluna entregador_id adicionada em pedidos_delivery';
END
$$;
