-- ============================================
-- FIX: Recriar trigger para criação de profiles
-- ============================================

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, profiles.nome),
    email = COALESCE(EXCLUDED.email, profiles.email);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Erro ao criar profile para usuário %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verificar
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger handle_new_user recriado com sucesso!';
END $$;
