-- ============================================
-- AUTO SUPER ADMIN: Primeiro usuário vira super admin
-- ============================================

-- Função para adicionar primeiro usuário como super admin
CREATE OR REPLACE FUNCTION public.auto_super_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verificar se já existe algum super admin
  SELECT COUNT(*) INTO v_count FROM public.super_admins WHERE ativo = true;
  
  -- Se não existe nenhum super admin, adicionar este usuário
  IF v_count = 0 THEN
    INSERT INTO public.super_admins (user_id, nome, email, ativo, permissoes)
    VALUES (
      NEW.id,
      COALESCE(NEW.nome, NEW.email),
      NEW.email,
      true,
      '["all"]'::jsonb
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE 'Super Admin criado automaticamente para: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar após criar profile
DROP TRIGGER IF EXISTS trigger_auto_super_admin ON public.profiles;
CREATE TRIGGER trigger_auto_super_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_super_admin();

-- Verificação
DO $$
BEGIN
  RAISE NOTICE '✅ Auto Super Admin configurado!';
  RAISE NOTICE 'O primeiro usuário a se cadastrar será automaticamente um Super Admin.';
END $$;
