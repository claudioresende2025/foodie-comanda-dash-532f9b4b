-- Migration: add signature and raw body preview to webhook_logs
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS stripe_signature text,
  ADD COLUMN IF NOT EXISTS raw_body text;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_stripe_signature ON public.webhook_logs (stripe_signature);