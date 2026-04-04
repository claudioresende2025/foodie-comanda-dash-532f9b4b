-- Migration: Adiciona o status 'solicitou_fechamento' ao enum mesa_status
-- Permite que clientes solicitem o fechamento da conta através do cardápio digital

-- Adicionar novo valor ao enum mesa_status
ALTER TYPE mesa_status ADD VALUE IF NOT EXISTS 'solicitou_fechamento';

-- Comentário explicativo
COMMENT ON TYPE mesa_status IS 'Status da mesa: disponivel, ocupada, reservada, juncao, solicitou_fechamento';
