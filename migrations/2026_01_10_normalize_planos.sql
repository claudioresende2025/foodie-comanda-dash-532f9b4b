-- Migration: 2026-01-10
-- Normaliza registros canônicos dos planos (slug, preços, recursos)
BEGIN;

-- Bronze
INSERT INTO public.planos (slug, nome, descricao, preco_mensal, preco_anual, trial_days, recursos, destaque, ordem, ativo, created_at, updated_at)
VALUES (
  'bronze',
  'Plano Bronze (Iniciante)',
  'Público Ideal: Lanchonetes e MEI',
  149.90,
  1798.80,
  3,
  to_jsonb(ARRAY[
    'Dashboard: Básico (Vendas do dia)',
    'Cardápio: Cardápio digital responsivo',
    'Mesas: ✅ Limitado (até 10 mesas)',
    'Pedidos (KDS): ✅ 1 tela',
    'Delivery: ✅ Básico (WhatsApp)',
    'Estatísticas Delivery: ❌ Não incluso',
    'Garçom (App): ✅ 1 usuário',
    'Marketing: ❌ Não incluso',
    'Equipe / Empresa: Até 2 colaboradores',
    'Caixa / Gestão: Fluxo de Caixa + Estoque'
  ]::text[]),
  false,
  1,
  true,
  now(),
  now()
)
ON CONFLICT (slug) DO UPDATE
  SET nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      preco_mensal = EXCLUDED.preco_mensal,
      preco_anual = EXCLUDED.preco_anual,
      trial_days = EXCLUDED.trial_days,
      recursos = EXCLUDED.recursos,
      destaque = EXCLUDED.destaque,
      ordem = EXCLUDED.ordem,
      ativo = EXCLUDED.ativo,
      updated_at = now();

-- Prata
INSERT INTO public.planos (slug, nome, descricao, preco_mensal, preco_anual, trial_days, recursos, destaque, ordem, ativo, created_at, updated_at)
VALUES (
  'prata',
  'Plano Prata (Crescimento)',
  'Público Ideal: Restaurantes com Mesas',
  299.90,
  3598.80,
  3,
  to_jsonb(ARRAY[
    'Tudo do Bronze: Todos os recursos do plano Bronze inclusos',
    'Mesas: ✅ Ilimitado',
    'Pedidos (KDS): ✅ 1 tela (padrão)',
    'Delivery: ✅ Integrado',
    'Estatísticas Delivery: ❌ Não incluso',
    'Garçom (App): ✅ Até 3 usuários',
    'Marketing: ❌ Não incluso',
    'Equipe / Empresa: Até 5 colaboradores',
    'Caixa / Gestão: Completo + Estoque'
  ]::text[]),
  false,
  2,
  true,
  now(),
  now()
)
ON CONFLICT (slug) DO UPDATE
  SET nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      preco_mensal = EXCLUDED.preco_mensal,
      preco_anual = EXCLUDED.preco_anual,
      trial_days = EXCLUDED.trial_days,
      recursos = EXCLUDED.recursos,
      destaque = EXCLUDED.destaque,
      ordem = EXCLUDED.ordem,
      ativo = EXCLUDED.ativo,
      updated_at = now();

-- Ouro
INSERT INTO public.planos (slug, nome, descricao, preco_mensal, preco_anual, trial_days, recursos, destaque, ordem, ativo, created_at, updated_at)
VALUES (
  'ouro',
  'Plano Ouro (Profissional)',
  'Público Ideal: Operações de Alto Volume',
  5498.90,
  65986.80,
  7,
  to_jsonb(ARRAY[
    'ACESSO TOTAL: Todos os recursos desbloqueados',
    'Mesas: ✅ Ilimitado',
    'Pedidos (KDS): ✅ Telas Ilimitadas',
    'Delivery: ✅ Integrado',
    'Estatísticas Delivery: ✅ Relatórios de Performance',
    'Garçom (App): ✅ Usuários Ilimitados',
    'Marketing: ✅ Cupons e Fidelidade',
    'Equipe / Empresa: Colaboradores Ilimitados',
    'Caixa / Gestão: Completo + Auditoria'
  ]::text[]),
  true,
  3,
  true,
  now(),
  now()
)
ON CONFLICT (slug) DO UPDATE
  SET nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      preco_mensal = EXCLUDED.preco_mensal,
      preco_anual = EXCLUDED.preco_anual,
      trial_days = EXCLUDED.trial_days,
      recursos = EXCLUDED.recursos,
      destaque = EXCLUDED.destaque,
      ordem = EXCLUDED.ordem,
      ativo = EXCLUDED.ativo,
      updated_at = now();

COMMIT;
