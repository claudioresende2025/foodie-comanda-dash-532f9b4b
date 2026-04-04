
-- Add solicitou_fechamento to mesa_status enum
ALTER TYPE mesa_status ADD VALUE IF NOT EXISTS 'solicitou_fechamento';

-- Create SECURITY DEFINER function for public mesa closure requests
CREATE OR REPLACE FUNCTION public.solicitar_fechamento_mesa(p_mesa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE mesas
  SET status = 'solicitou_fechamento', updated_at = now()
  WHERE id = p_mesa_id
    AND status IN ('ocupada', 'disponivel');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa não encontrada ou já em processo de fechamento';
  END IF;
END;
$$;
