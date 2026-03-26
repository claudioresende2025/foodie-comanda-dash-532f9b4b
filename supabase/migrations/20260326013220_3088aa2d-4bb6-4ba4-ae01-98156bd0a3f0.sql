CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL DEFAULT '',
  auth_key text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'admin',
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access" ON public.push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);