-- Migration: seed default plans (upsert)
-- Execute this with the Supabase service_role (SQL Editor > Run)

-- Basico
insert into public.planos (id, nome, descricao, preco_mensal, preco_anual, recursos, limite_pedidos_mes, limite_mesas, limite_usuarios, destaque, ordem, ativo, created_at, updated_at)
values (
  'basico',
  'Básico',
  'Tudo que você precisa para começar: cardápio digital, comandas e delivery.',
  149.90,
  round(149.90 * 12 * 0.9),
  '["Cardápio digital","Comandas","Delivery"]'::jsonb,
  null,
  null,
  null,
  false,
  1,
  true,
  now(), now()
)
on conflict (id) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  preco_mensal = excluded.preco_mensal,
  preco_anual = excluded.preco_anual,
  recursos = excluded.recursos,
  destaque = excluded.destaque,
  ordem = excluded.ordem,
  ativo = excluded.ativo,
  updated_at = now();

-- Profissional
insert into public.planos (id, nome, descricao, preco_mensal, preco_anual, recursos, limite_pedidos_mes, limite_mesas, limite_usuarios, destaque, ordem, ativo, created_at, updated_at)
values (
  'profissional',
  'Profissional',
  'Relatórios avançados e suporte prioritário para aumentar suas vendas.',
  299.90,
  round(299.90 * 12 * 0.9),
  '["Tudo do Básico","Relatórios","Suporte prioritário"]'::jsonb,
  null,
  null,
  null,
  true,
  2,
  true,
  now(), now()
)
on conflict (id) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  preco_mensal = excluded.preco_mensal,
  preco_anual = excluded.preco_anual,
  recursos = excluded.recursos,
  destaque = excluded.destaque,
  ordem = excluded.ordem,
  ativo = excluded.ativo,
  updated_at = now();

-- Enterprise / Avançado
insert into public.planos (id, nome, descricao, preco_mensal, preco_anual, recursos, limite_pedidos_mes, limite_mesas, limite_usuarios, destaque, ordem, ativo, created_at, updated_at)
values (
  'enterprise',
  'Enterprise',
  'Integrações e SLA dedicado para operações maiores e multi-unidade.',
  549.90,
  round(549.90 * 12 * 0.9),
  '["Tudo do Profissional","Integrações","SLA dedicado"]'::jsonb,
  null,
  null,
  null,
  false,
  3,
  true,
  now(), now()
)
on conflict (id) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  preco_mensal = excluded.preco_mensal,
  preco_anual = excluded.preco_anual,
  recursos = excluded.recursos,
  destaque = excluded.destaque,
  ordem = excluded.ordem,
  ativo = excluded.ativo,
  updated_at = now();
