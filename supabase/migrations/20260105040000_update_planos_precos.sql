-- ============================================
-- ATUALIZAÇÃO DE PREÇOS DOS PLANOS
-- ============================================

-- Básico: R$ 149,90/mês | R$ 1.499,00/ano
UPDATE public.planos 
SET preco_mensal = 149.90, preco_anual = 1499.00, updated_at = NOW()
WHERE nome = 'Básico';

-- Profissional: R$ 229,90/mês | R$ 2.299,00/ano
UPDATE public.planos 
SET preco_mensal = 229.90, preco_anual = 2299.00, updated_at = NOW()
WHERE nome = 'Profissional';

-- Enterprise: R$ 529,90/mês | R$ 5.299,00/ano
UPDATE public.planos 
SET preco_mensal = 529.90, preco_anual = 5299.00, updated_at = NOW()
WHERE nome = 'Enterprise';

-- Verificação
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT nome, preco_mensal, preco_anual FROM public.planos ORDER BY ordem LOOP
    RAISE NOTICE 'Plano %: R$ %/mês | R$ %/ano', r.nome, r.preco_mensal, r.preco_anual;
  END LOOP;
END $$;
