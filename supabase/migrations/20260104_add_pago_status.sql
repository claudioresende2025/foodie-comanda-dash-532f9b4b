-- Migration: Adicionar valor 'pago' ao enum delivery_status
-- Descrição: Adiciona o status 'pago' para pedidos que foram pagos via cartão de crédito

-- Adicionar novo valor ao enum delivery_status
ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'pago' AFTER 'pendente';

-- Nota: O status 'pago' será usado para pedidos que foram pagos via cartão de crédito
-- O fluxo fica: pendente -> pago -> confirmado -> em_preparo -> saiu_entrega -> entregue
-- Para PIX, o pedido começa como 'pendente' e vai para 'confirmado' após confirmação manual
