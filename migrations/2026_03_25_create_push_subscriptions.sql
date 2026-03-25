-- =============================================
-- Migração: Criar tabela push_subscriptions
-- Data: 2026-03-25
-- Descrição: Tabela para armazenar subscriptions de Web Push
-- =============================================

-- Tabela para armazenar Web Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  type text NOT NULL DEFAULT 'admin' CHECK (type IN ('admin', 'delivery')),
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(endpoint)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_empresa_id ON public.push_subscriptions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_type ON public.push_subscriptions(type);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trigger_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- Habilitar RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Usuário pode gerenciar suas próprias subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Staff pode ler subscriptions da empresa (para envio de notificações)
CREATE POLICY "Staff can read empresa push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Comentários para documentação
COMMENT ON TABLE public.push_subscriptions IS 'Armazena Web Push subscriptions para notificações nativas';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'URL única do Push Service para este dispositivo';
COMMENT ON COLUMN public.push_subscriptions.p256dh IS 'Chave pública do cliente para criptografia';
COMMENT ON COLUMN public.push_subscriptions.auth_key IS 'Segredo de autenticação do cliente';
COMMENT ON COLUMN public.push_subscriptions.type IS 'Tipo de subscription: admin (para loja) ou delivery (para cliente)';
