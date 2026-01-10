-- Migration: 2026-01-10
-- Cria seed de planos e tabela de overrides por empresa
BEGIN;

-- Tabela planos (se não existir) - guarda configurações básicas
CREATE TABLE IF NOT EXISTS public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome text NOT NULL,
  preco numeric(10,2) NOT NULL,
  trial_days integer DEFAULT 0,
  recursos jsonb DEFAULT '{}'::jsonb,
  criado_em timestamptz DEFAULT now()
);

-- Tabela de overrides por empresa (super-admin pode alterar manualmente)
CREATE TABLE IF NOT EXISTS public.empresa_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  kds_screens_limit integer,
  staff_limit integer,
  updated_at timestamptz DEFAULT now()
);

-- Seed de planos (idempotente)
INSERT INTO public.planos (slug, nome, preco, trial_days, recursos)
VALUES
('bronze','Bronze',129.90,3, '{"dashboard": true, "cardapio": true, "caixa": true, "empresa": true, "configuracoes": true, "mesas": false, "kds": false, "delivery": false, "estatisticas": false, "marketing": false, "garcom": false, "equipe": false }'),
('prata','Prata',199.90,3, '{"dashboard": true, "cardapio": true, "caixa": true, "empresa": true, "configuracoes": true, "mesas": true, "kds": true, "kds_screens": 1, "delivery": true, "garcom": true, "equipe": true, "equipe_limit": 5, "estatisticas": false, "marketing": false }'),
('ouro','Ouro',489.90,7, '{"dashboard": true, "cardapio": true, "caixa": true, "empresa": true, "configuracoes": true, "mesas": true, "kds": true, "kds_screens": null, "delivery": true, "garcom": true, "equipe": true, "equipe_limit": null, "estatisticas": true, "marketing": true }')
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, preco = EXCLUDED.preco, trial_days = EXCLUDED.trial_days, recursos = EXCLUDED.recursos;

COMMIT;
