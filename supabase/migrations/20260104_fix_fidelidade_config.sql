-- Adicionar campos faltantes na tabela fidelidade_config
ALTER TABLE public.fidelidade_config 
ADD COLUMN IF NOT EXISTS pontos_necessarios INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS valor_recompensa DECIMAL(10,2) DEFAULT 15.00;

-- Atualizar registros existentes
UPDATE public.fidelidade_config 
SET 
  pontos_necessarios = 100,
  valor_recompensa = 15.00
WHERE pontos_necessarios IS NULL OR valor_recompensa IS NULL;
