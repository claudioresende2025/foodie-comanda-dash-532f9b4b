-- Migration: create webhook_logs table for debugging Stripe webhooks
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text,
  referencia text,
  empresa_id uuid,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_empresa ON public.webhook_logs (empresa_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs (created_at);
