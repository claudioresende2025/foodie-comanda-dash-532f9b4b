-- Migration: Criar função RPC para liberar mesa
-- Data: 2026-02-25
-- Problema: O código frontend não consegue atualizar o status da mesa devido ao RLS

-- Função RPC com SECURITY DEFINER para liberar mesa
-- Isso garante que a atualização funcione independente do RLS
CREATE OR REPLACE FUNCTION public.liberar_mesa(p_mesa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza a mesa para disponível
  UPDATE public.mesas 
  SET 
    status = 'disponivel', 
    mesa_juncao_id = NULL,
    updated_at = now()
  WHERE id = p_mesa_id;
  
  -- Se for uma mesa principal de junção, libera também as mesas filhas
  UPDATE public.mesas 
  SET 
    status = 'disponivel', 
    mesa_juncao_id = NULL,
    updated_at = now()
  WHERE mesa_juncao_id = p_mesa_id;
END;
$$;

-- Concede permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.liberar_mesa(uuid) TO authenticated;

-- Também recriar o trigger para garantir que está funcionando
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
      SET status = 'disponivel', mesa_juncao_id = NULL, updated_at = now()
      WHERE id = NEW.mesa_id;
      
      -- Também libera mesas filhas se houver junção
      UPDATE public.mesas 
      SET status = 'disponivel', mesa_juncao_id = NULL, updated_at = now()
      WHERE mesa_juncao_id = NEW.mesa_id;
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

-- Comentário
COMMENT ON FUNCTION public.liberar_mesa(uuid) IS 'Libera uma mesa (e suas mesas filhas de junção) para status disponível';
