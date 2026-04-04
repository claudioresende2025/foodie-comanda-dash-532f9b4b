-- Add PIX key field to empresas table
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS chave_pix TEXT;