-- Criar tabela webhook_logs para auditoria de eventos Stripe
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  referencia text,
  empresa_id uuid REFERENCES public.empresas(id),
  payload jsonb,
  status text DEFAULT 'processed',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS webhook_logs_empresa_idx ON public.webhook_logs(empresa_id);
CREATE INDEX IF NOT EXISTS webhook_logs_event_idx ON public.webhook_logs(event);
CREATE INDEX IF NOT EXISTS webhook_logs_created_idx ON public.webhook_logs(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy para service role (webhooks usam service role)
CREATE POLICY "Service role full access on webhook_logs" ON public.webhook_logs
  FOR ALL USING (true) WITH CHECK (true);