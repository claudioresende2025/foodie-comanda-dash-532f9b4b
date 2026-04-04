-- Migration: cria tabela webhook_logs para depuração de webhooks
-- Gerado em 2026-01-12

BEGIN;

-- Habilita extensão de geração de UUID se necessário
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  referencia text,
  empresa_id uuid NULL,
  payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS webhook_logs_empresa_idx ON public.webhook_logs (empresa_id);
CREATE INDEX IF NOT EXISTS webhook_logs_created_idx ON public.webhook_logs (created_at);

COMMIT;