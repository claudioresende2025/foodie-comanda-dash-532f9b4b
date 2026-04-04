-- ============================================
-- ATUALIZAÇÃO: TRIAL DE 14 PARA 7 DIAS
-- Data: 2026-03-10
-- ============================================

-- 1. Atualizar configuração de dias de trial na config_sistema
UPDATE public.config_sistema 
SET valor = '7', updated_at = NOW() 
WHERE chave = 'trial_days';

-- 2. Inserir se não existir
INSERT INTO public.config_sistema (chave, valor, tipo, descricao, grupo)
VALUES ('trial_days', '7', 'number', 'Dias de trial gratuito', 'geral')
ON CONFLICT (chave) DO UPDATE SET valor = '7', updated_at = NOW();

-- 3. Atualizar trial_days em todos os planos
UPDATE public.planos 
SET trial_days = 7, updated_at = NOW() 
WHERE trial_days IS NULL OR trial_days != 7;

-- 4. Atualizar o default da coluna trial_end na tabela assinaturas
ALTER TABLE public.assinaturas 
ALTER COLUMN trial_end SET DEFAULT (NOW() + INTERVAL '7 days');

-- 5. Recriar função de trial com 7 dias
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar assinatura de trial automaticamente quando empresa é criada
  INSERT INTO public.assinaturas (empresa_id, status, trial_start, trial_end)
  VALUES (NEW.id, 'trialing', NOW(), NOW() + INTERVAL '7 days')
  ON CONFLICT (empresa_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Verificação
DO $$
DECLARE
  v_trial_days TEXT;
BEGIN
  SELECT valor INTO v_trial_days FROM public.config_sistema WHERE chave = 'trial_days';
  RAISE NOTICE 'Trial configurado para % dias', v_trial_days;
END $$;
