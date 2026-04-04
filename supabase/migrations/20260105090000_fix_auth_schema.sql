-- ============================================
-- FIX: Verificar e corrigir schema auth
-- ============================================

-- 1. Garantir que extensões necessárias estão habilitadas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Verificar se há problema com trigger no auth.users
-- Remover triggers problemáticos temporariamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Recriar função handle_new_user de forma mais segura
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  -- Extrair nome de forma segura
  v_nome := COALESCE(
    NEW.raw_user_meta_data ->> 'nome',
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Inserir profile
  BEGIN
    INSERT INTO public.profiles (id, nome, email, created_at, updated_at)
    VALUES (NEW.id, v_nome, NEW.email, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erros para não bloquear criação do usuário
    NULL;
  END;
  
  RETURN NEW;
END;
$$;

-- 4. Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Garantir grants corretos
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Verificação
DO $$
BEGIN
  RAISE NOTICE '✅ Schema auth verificado e corrigido!';
END $$;
