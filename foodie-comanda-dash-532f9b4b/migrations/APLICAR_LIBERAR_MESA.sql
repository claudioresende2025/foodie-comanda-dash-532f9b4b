-- =====================================================
-- EXECUTAR NO SUPABASE SQL EDITOR
-- Corrige a função para liberar mesa após pagamento
-- =====================================================

-- 1. Criar/Atualizar função RPC para liberar mesa
CREATE OR REPLACE FUNCTION public.liberar_mesa(p_mesa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log para debug
  RAISE NOTICE 'Liberando mesa: %', p_mesa_id;
  
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
  
  RAISE NOTICE 'Mesa % liberada com sucesso', p_mesa_id;
END;
$$;

-- 2. Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION public.liberar_mesa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_mesa(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.liberar_mesa(uuid) TO service_role;

-- 3. Recriar o trigger para garantir que funciona
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

-- 4. Remover e recriar trigger
DROP TRIGGER IF EXISTS trigger_update_mesa_status ON public.comandas;

CREATE TRIGGER trigger_update_mesa_status
AFTER INSERT OR UPDATE ON public.comandas
FOR EACH ROW
EXECUTE FUNCTION public.update_mesa_status_on_comanda();

-- 5. Verificar se funcionou (execute após o script acima)
-- SELECT * FROM public.mesas WHERE status = 'ocupada';
