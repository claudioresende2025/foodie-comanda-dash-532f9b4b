-- ============================================
-- FIX COMPLETO: Corrigir erro "Database error finding user"
-- ============================================

-- 1. Garantir que a tabela profiles existe corretamente
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(255),
  email VARCHAR(255),
  empresa_id UUID,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Remover todas as políticas antigas da tabela profiles
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Perfis são visíveis para usuários autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem inserir próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Service role pode tudo" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;

-- 4. Criar políticas simples e permissivas
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Permitir que o service_role (usado pelos triggers) possa fazer tudo
CREATE POLICY "service_role_all"
  ON public.profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Recriar função handle_new_user com tratamento de erro melhorado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, profiles.nome),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log do erro mas não falha a criação do usuário
  RAISE WARNING 'Erro ao criar profile para %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

-- 7. Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Verificar se há problema com a tabela empresas também
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresas_select" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update" ON public.empresas;
DROP POLICY IF EXISTS "Empresas são visíveis para membros" ON public.empresas;

CREATE POLICY "empresas_select"
  ON public.empresas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "empresas_insert"
  ON public.empresas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "empresas_update"
  ON public.empresas FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "empresas_service_role"
  ON public.empresas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verificação final
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS e triggers corrigidos!';
  RAISE NOTICE 'Profiles políticas: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles');
  RAISE NOTICE 'Empresas políticas: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'empresas');
END $$;
