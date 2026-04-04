-- Criar tabela de planos
CREATE TABLE IF NOT EXISTS public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  preco_mensal numeric NOT NULL DEFAULT 0,
  preco_anual numeric NOT NULL DEFAULT 0,
  recursos jsonb DEFAULT '{}',
  limite_pedidos_mes integer,
  limite_mesas integer,
  limite_usuarios integer,
  kds_screens integer DEFAULT 1,
  staff_limit integer DEFAULT 1,
  garcom_limit integer DEFAULT 1,
  trial_days integer DEFAULT 3,
  destaque boolean DEFAULT false,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  stripe_price_id_mensal text,
  stripe_price_id_anual text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id),
  status text NOT NULL DEFAULT 'trial',
  periodo text NOT NULL DEFAULT 'mensal',
  data_inicio timestamptz DEFAULT now(),
  data_fim timestamptz,
  trial_fim timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id)
);

-- Criar tabela de overrides por empresa (super admin)
CREATE TABLE IF NOT EXISTS public.empresa_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE UNIQUE,
  overrides jsonb DEFAULT '{}',
  kds_screens_limit integer,
  staff_limit integer,
  mesas_limit integer,
  garcom_limit integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de super admins
CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Políticas para planos (leitura pública)
CREATE POLICY "Planos são visíveis publicamente"
  ON public.planos FOR SELECT
  USING (true);

-- Políticas para assinaturas
CREATE POLICY "Usuários podem ver assinatura da empresa"
  ON public.assinaturas FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role pode gerenciar assinaturas"
  ON public.assinaturas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas para empresa_overrides
CREATE POLICY "Usuários podem ver overrides da empresa"
  ON public.empresa_overrides FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role pode gerenciar overrides"
  ON public.empresa_overrides FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Políticas para super_admins
CREATE POLICY "Super admins podem ver a si mesmos"
  ON public.super_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Inserir planos padrão
INSERT INTO public.planos (nome, slug, descricao, preco_mensal, preco_anual, recursos, limite_mesas, staff_limit, kds_screens, garcom_limit, trial_days, destaque, ordem)
VALUES 
  ('Bronze', 'bronze', 'Plano Iniciante - Ideal para lanchonetes e MEI', 149.90, 1498.80, 
   '{"dashboard": true, "cardapio": true, "delivery": "whatsapp", "empresa": true, "caixa": true, "mesas": true, "kds": true, "garcom": true, "estatisticas": false, "marketing": false, "equipe": false, "pedidos": true, "configuracoes": true}'::jsonb,
   10, 2, 1, 1, 3, false, 1),
  ('Prata', 'prata', 'Plano Crescimento - Ideal para restaurantes com mesas', 299.90, 2998.80,
   '{"dashboard": true, "cardapio": true, "delivery": true, "empresa": true, "caixa": true, "mesas": true, "kds": true, "garcom": true, "estatisticas": false, "marketing": false, "equipe": true, "pedidos": true, "configuracoes": true}'::jsonb,
   null, 5, 1, 3, 3, true, 2),
  ('Ouro', 'ouro', 'Plano Profissional - Operações de Alto Volume', 549.90, 5498.80,
   '{"dashboard": true, "cardapio": true, "delivery": true, "empresa": true, "caixa": true, "mesas": true, "kds": true, "garcom": true, "estatisticas": true, "marketing": true, "equipe": true, "pedidos": true, "configuracoes": true}'::jsonb,
   null, null, null, null, 7, false, 3)
ON CONFLICT (slug) DO UPDATE SET
  preco_mensal = EXCLUDED.preco_mensal,
  preco_anual = EXCLUDED.preco_anual,
  recursos = EXCLUDED.recursos,
  limite_mesas = EXCLUDED.limite_mesas,
  staff_limit = EXCLUDED.staff_limit,
  kds_screens = EXCLUDED.kds_screens,
  garcom_limit = EXCLUDED.garcom_limit,
  trial_days = EXCLUDED.trial_days,
  descricao = EXCLUDED.descricao,
  updated_at = now();

-- Função RPC para upsert overrides (security definer)
CREATE OR REPLACE FUNCTION public.upsert_empresa_overrides(
  p_empresa_id uuid,
  p_overrides jsonb,
  p_kds_screens_limit integer DEFAULT NULL,
  p_staff_limit integer DEFAULT NULL,
  p_mesas_limit integer DEFAULT NULL,
  p_garcom_limit integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.empresa_overrides (empresa_id, overrides, kds_screens_limit, staff_limit, mesas_limit, garcom_limit, created_at, updated_at)
  VALUES (p_empresa_id, p_overrides, p_kds_screens_limit, p_staff_limit, p_mesas_limit, p_garcom_limit, now(), now())
  ON CONFLICT (empresa_id) DO UPDATE
    SET overrides = COALESCE(EXCLUDED.overrides, empresa_overrides.overrides),
        kds_screens_limit = EXCLUDED.kds_screens_limit,
        staff_limit = EXCLUDED.staff_limit,
        mesas_limit = EXCLUDED.mesas_limit,
        garcom_limit = EXCLUDED.garcom_limit,
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_empresa_overrides(uuid, jsonb, integer, integer, integer, integer) TO authenticated;

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER update_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_empresa_overrides_updated_at
  BEFORE UPDATE ON public.empresa_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();