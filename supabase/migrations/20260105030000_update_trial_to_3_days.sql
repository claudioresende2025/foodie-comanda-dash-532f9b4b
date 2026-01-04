-- ============================================
-- ATUALIZAÇÃO: TRIAL DE 7 PARA 3 DIAS
-- ============================================

-- 1. Atualizar configuração de dias de trial
UPDATE public.config_sistema 
SET valor = '3', updated_at = NOW() 
WHERE chave = 'trial_days';

-- 2. Inserir se não existir
INSERT INTO public.config_sistema (chave, valor, tipo, descricao, grupo)
VALUES ('trial_days', '3', 'number', 'Dias de trial gratuito', 'geral')
ON CONFLICT (chave) DO UPDATE SET valor = '3', updated_at = NOW();

-- 3. Atualizar o default da coluna trial_end na tabela assinaturas
ALTER TABLE public.assinaturas 
ALTER COLUMN trial_end SET DEFAULT (NOW() + INTERVAL '3 days');

-- 4. Recriar função de trial com 3 dias
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar assinatura de trial automaticamente quando empresa é criada
  INSERT INTO public.assinaturas (empresa_id, status, trial_start, trial_end)
  VALUES (NEW.id, 'trialing', NOW(), NOW() + INTERVAL '3 days')
  ON CONFLICT (empresa_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificação
DO $$
DECLARE
  v_trial_days TEXT;
BEGIN
  SELECT valor INTO v_trial_days FROM public.config_sistema WHERE chave = 'trial_days';
  RAISE NOTICE 'Trial configurado para % dias', v_trial_days;
END $$;
