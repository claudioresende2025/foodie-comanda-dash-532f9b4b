-- Função para atualizar status da mesa automaticamente
CREATE OR REPLACE FUNCTION public.update_mesa_status_on_comanda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando uma nova comanda é criada com status 'aberta'
  IF TG_OP = 'INSERT' AND NEW.mesa_id IS NOT NULL AND NEW.status = 'aberta' THEN
    UPDATE public.mesas 
    SET status = 'ocupada', updated_at = now()
    WHERE id = NEW.mesa_id AND status = 'disponivel';
  END IF;
  
  -- Quando uma comanda é fechada ou cancelada
  IF TG_OP = 'UPDATE' AND NEW.mesa_id IS NOT NULL AND NEW.status IN ('fechada', 'cancelada') THEN
    -- Só muda para disponível se não houver outras comandas abertas para essa mesa
    IF NOT EXISTS (
      SELECT 1 FROM public.comandas 
      WHERE mesa_id = NEW.mesa_id 
      AND status = 'aberta' 
      AND id != NEW.id
    ) THEN
      UPDATE public.mesas 
      SET status = 'disponivel', updated_at = now()
      WHERE id = NEW.mesa_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remove trigger se existir
DROP TRIGGER IF EXISTS trigger_update_mesa_status ON public.comandas;

-- Cria o trigger
CREATE TRIGGER trigger_update_mesa_status
AFTER INSERT OR UPDATE ON public.comandas
FOR EACH ROW
EXECUTE FUNCTION public.update_mesa_status_on_comanda();