-- =====================================================
-- HABILITAR REALTIME PARA PEDIDOS_DELIVERY
-- Data: 2026-03-12
-- Corrige o problema de status não atualizando em tempo real
-- =====================================================

-- Verificar e adicionar tabelas à publicação realtime (ignorando se já existir)
DO $$
BEGIN
    -- Tentar adicionar pedidos_delivery
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_delivery;
        RAISE NOTICE '✅ Tabela pedidos_delivery adicionada ao realtime';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️ Tabela pedidos_delivery já está no realtime';
    END;
    
    -- Tentar adicionar delivery_locations
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_locations;
        RAISE NOTICE '✅ Tabela delivery_locations adicionada ao realtime';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️ Tabela delivery_locations já está no realtime';
    END;
END
$$;

-- Garantir que a replica identity está configurada corretamente
ALTER TABLE public.pedidos_delivery REPLICA IDENTITY FULL;
ALTER TABLE public.delivery_locations REPLICA IDENTITY FULL;

-- Verificar publicação
DO $$
DECLARE
    tables_in_pub TEXT[];
BEGIN
    SELECT array_agg(tablename::text) INTO tables_in_pub
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime';
    
    RAISE NOTICE 'Tabelas na publicação realtime: %', tables_in_pub;
END
$$;
