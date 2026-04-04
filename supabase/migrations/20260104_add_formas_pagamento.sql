-- Migration para adicionar coluna formas_pagamento na tabela comandas
-- Esta coluna armazena múltiplas formas de pagamento no formato: "pix:50.00,dinheiro:30.00,cartao_credito:20.00"

ALTER TABLE comandas 
ADD COLUMN IF NOT EXISTS formas_pagamento TEXT;

-- Adiciona comentário explicativo
COMMENT ON COLUMN comandas.formas_pagamento IS 'Múltiplas formas de pagamento no formato: metodo:valor,metodo:valor';
