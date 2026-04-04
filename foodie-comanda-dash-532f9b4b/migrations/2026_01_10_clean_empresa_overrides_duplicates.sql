-- Migration: 2026-01-10
-- Consolida duplicatas em empresa_overrides mantendo o registro mais recente
BEGIN;

DO $$
DECLARE
  r RECORD;
  keep_id uuid;
BEGIN
  -- Cria tabela de backup caso não exista
  CREATE TABLE IF NOT EXISTS public.empresa_overrides_backup (LIKE public.empresa_overrides INCLUDING ALL);

  FOR r IN
    SELECT empresa_id, array_agg(id ORDER BY COALESCE(updated_at, now()) DESC) AS ids
    FROM public.empresa_overrides
    GROUP BY empresa_id
    HAVING count(*) > 1
  LOOP
    keep_id := r.ids[1];
    -- copia os registros que serão removidos para backup
    INSERT INTO public.empresa_overrides_backup
    SELECT * FROM public.empresa_overrides WHERE empresa_id = r.empresa_id AND id <> keep_id;

    -- remove duplicatas (mantém keep_id)
    DELETE FROM public.empresa_overrides WHERE empresa_id = r.empresa_id AND id <> keep_id;

    RAISE NOTICE 'Consolidated duplicates for empresa_id %', r.empresa_id;
  END LOOP;

  -- cria índice único se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'empresa_overrides' AND indexname = 'uniq_empresa_overrides_empresa_id'
  ) THEN
    CREATE UNIQUE INDEX uniq_empresa_overrides_empresa_id ON public.empresa_overrides (empresa_id);
    RAISE NOTICE 'Unique index created on empresa_overrides(empresa_id)';
  ELSE
    RAISE NOTICE 'Unique index already exists';
  END IF;
END
$$;

COMMIT;
