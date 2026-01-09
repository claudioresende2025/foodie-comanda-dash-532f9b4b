-- Migration: Corrige colunas da tabela promocoes (tipo / preco_promocional / preco)
-- Data: 2026-01-09

-- 1) Garante existência das colunas essenciais
ALTER TABLE public.promocoes
ADD COLUMN IF NOT EXISTS tipo varchar(50);

ALTER TABLE public.promocoes
ADD COLUMN IF NOT EXISTS preco_promocional numeric(10,2);

ALTER TABLE public.promocoes
ADD COLUMN IF NOT EXISTS preco numeric(10,2);

-- 2) Backfills e normalizações seguras
DO $$
BEGIN
  -- Se existir coluna preco_promocional e tiver registros válidos, tenta normalizar
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promocoes' AND column_name = 'preco_promocional'
  ) THEN
    UPDATE public.promocoes
    SET preco_promocional = (regexp_replace(preco_promocional::text, ',', '.', 'g'))::numeric
    WHERE preco_promocional IS NOT NULL
      AND (preco_promocional::text ~ '^[0-9]+([\.,][0-9]{1,2})?$');
  END IF;

  -- Se preco estiver preenchido e preco_promocional vazio, copie para preco_promocional
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promocoes' AND column_name = 'preco'
  ) THEN
    UPDATE public.promocoes
    SET preco_promocional = preco
    WHERE preco_promocional IS NULL AND preco IS NOT NULL;
  END IF;

  -- Preencher campo tipo com valor padrão 'fixo' quando vazio
  UPDATE public.promocoes
  SET tipo = 'fixo'
  WHERE tipo IS NULL;
END
$$ LANGUAGE plpgsql;

-- 3) Define default e NOT NULL para 'tipo' de forma segura
DO $$
BEGIN
  -- Define default
  IF (SELECT column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='promocoes' AND column_name='tipo') IS NULL THEN
    ALTER TABLE public.promocoes ALTER COLUMN tipo SET DEFAULT 'fixo';
  END IF;

  -- Tenta aplicar NOT NULL se não houver valores nulos
  IF NOT EXISTS (SELECT 1 FROM public.promocoes WHERE tipo IS NULL) THEN
    ALTER TABLE public.promocoes ALTER COLUMN tipo SET NOT NULL;
  ELSE
    RAISE NOTICE 'Existem % registros com tipo NULL. NOT NULL não aplicado.', (SELECT count(*) FROM public.promocoes WHERE tipo IS NULL);
  END IF;
END
$$ LANGUAGE plpgsql;

-- 4) Garante constraint de preço positiva (aplica apenas se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.conname = 'promocoes_preco_positive' AND t.relname = 'promocoes'
  ) THEN
    ALTER TABLE public.promocoes
    ADD CONSTRAINT promocoes_preco_positive CHECK (preco IS NULL OR preco > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.conname = 'promocoes_preco_promocional_positive' AND t.relname = 'promocoes'
  ) THEN
    ALTER TABLE public.promocoes
    ADD CONSTRAINT promocoes_preco_promocional_positive CHECK (preco_promocional IS NULL OR preco_promocional > 0);
  END IF;
END
$$ LANGUAGE plpgsql;

-- 5) Verificação rápida
SELECT id, nome, tipo, preco, preco_promocional, created_at
FROM public.promocoes
ORDER BY created_at DESC
LIMIT 50;
