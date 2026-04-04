-- Migration: 2026-01-10
-- Atualiza (ou cria) o plano 'bronze' com recursos recomendados
BEGIN;

INSERT INTO public.planos (slug, nome, preco, trial_days, recursos)
VALUES (
  'bronze',
  'Bronze',
  129.90,
  3,
  '{
    "dashboard": true,
    "cardapio": true,
    "caixa": true,
    "empresa": true,
    "configuracoes": true,
    "mesas": true,
    "kds": false,
    "kds_screens": null,
    "delivery": false,
    "marketing": false,
    "garcom": false,
    "equipe": false,
    "equipe_limit": null,
    "estatisticas": false
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
SET nome = EXCLUDED.nome,
    preco = EXCLUDED.preco,
    trial_days = EXCLUDED.trial_days,
    recursos = EXCLUDED.recursos;

COMMIT;
