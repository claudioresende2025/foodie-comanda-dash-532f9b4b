-- ===========================================
-- HABILITA REALTIME PARA CONFIG_DELIVERY
-- Permite que clientes vejam mudanças em tempo real
-- ===========================================

DO $$
BEGIN
    -- Adicionar config_delivery ao realtime se ainda não estiver
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'config_delivery'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.config_delivery;
        RAISE NOTICE 'config_delivery adicionada ao realtime';
    ELSE
        RAISE NOTICE 'config_delivery já está no realtime';
    END IF;
END $$;
