-- Migration: 2026-01-10
-- Adiciona índice/constraint única em empresa_overrides(empresa_id)
BEGIN;

DO $$
BEGIN
  -- Se existirem duplicatas, abortamos com NOTICE (evita DROP/DELETE automático)
  IF EXISTS (
    SELECT 1 FROM public.empresa_overrides GROUP BY empresa_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Duplicatas encontradas em empresa_overrides. Remova duplicatas antes de aplicar a constraint única.';
  ELSE
    -- Cria índice único se ainda não existir
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'empresa_overrides' AND indexname = 'uniq_empresa_overrides_empresa_id'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uniq_empresa_overrides_empresa_id ON public.empresa_overrides (empresa_id)';
    END IF;
  END IF;
END
$$;

COMMIT;
