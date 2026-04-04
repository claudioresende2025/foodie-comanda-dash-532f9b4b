-- Migration: 2026-01-09
-- Adiciona a coluna `nome` na tabela `mesas` caso não exista
-- e tenta fazer um backfill a partir de `reservas` quando aplicável.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mesas' AND column_name = 'nome'
  ) THEN
    ALTER TABLE public.mesas ADD COLUMN nome text;
    RAISE NOTICE 'Coluna nome adicionada em public.mesas';
  ELSE
    RAISE NOTICE 'Coluna nome já existe em public.mesas';
  END IF;
END
$$;

-- Se houver a tabela `reservas` com `mesa_id` e `nome`, tenta backfill mais recente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservas' AND column_name = 'mesa_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservas' AND column_name = 'nome'
  ) THEN
    WITH latest_reservas AS (
      SELECT DISTINCT ON (mesa_id) mesa_id, nome
      FROM public.reservas
      WHERE nome IS NOT NULL
      ORDER BY mesa_id, created_at DESC NULLS LAST
    )
    UPDATE public.mesas m
    SET nome = lr.nome
    FROM latest_reservas lr
    WHERE m.id = lr.mesa_id AND (m.nome IS NULL OR m.nome = '');
    RAISE NOTICE 'Backfill de nome a partir de reservas executado quando aplicável';
  ELSE
    RAISE NOTICE 'Backfill não executado (reservas.nome ou reservas.mesa_id ausentes)';
  END IF;
END
$$;

COMMIT;
