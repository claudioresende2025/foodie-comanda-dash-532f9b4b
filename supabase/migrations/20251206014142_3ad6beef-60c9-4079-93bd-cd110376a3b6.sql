
-- =====================================================
-- FOREIGN KEY CONSTRAINTS (Using DO blocks to check existence)
-- =====================================================

-- Chamadas Garcom -> Empresas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamadas_garcom_empresa_id_fkey') THEN
    ALTER TABLE public.chamadas_garcom ADD CONSTRAINT chamadas_garcom_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Chamadas Garcom -> Mesas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamadas_garcom_mesa_id_fkey') THEN
    ALTER TABLE public.chamadas_garcom ADD CONSTRAINT chamadas_garcom_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES public.mesas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Chamadas Garcom -> Comandas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamadas_garcom_comanda_id_fkey') THEN
    ALTER TABLE public.chamadas_garcom ADD CONSTRAINT chamadas_garcom_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Comandas -> Empresas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comandas_empresa_id_fkey') THEN
    ALTER TABLE public.comandas ADD CONSTRAINT comandas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Comandas -> Mesas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comandas_mesa_id_fkey') THEN
    ALTER TABLE public.comandas ADD CONSTRAINT comandas_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES public.mesas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Comandas -> Comanda Mestre
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comandas_comanda_mestre_id_fkey') THEN
    ALTER TABLE public.comandas ADD CONSTRAINT comandas_comanda_mestre_id_fkey FOREIGN KEY (comanda_mestre_id) REFERENCES public.comandas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Empresas -> Auth Users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_usuario_proprietario_id_fkey') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT empresas_usuario_proprietario_id_fkey FOREIGN KEY (usuario_proprietario_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Mesas -> Empresas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mesas_empresa_id_fkey') THEN
    ALTER TABLE public.mesas ADD CONSTRAINT mesas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Mesas -> Mesa Junção
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mesas_mesa_juncao_id_fkey') THEN
    ALTER TABLE public.mesas ADD CONSTRAINT mesas_mesa_juncao_id_fkey FOREIGN KEY (mesa_juncao_id) REFERENCES public.mesas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Pedidos -> Comandas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_comanda_id_fkey') THEN
    ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Pedidos -> Produtos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_produto_id_fkey') THEN
    ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Produtos -> Empresas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_empresa_id_fkey') THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Produtos -> Categorias
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produtos_categoria_id_fkey') THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Profiles -> Auth Users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Profiles -> Empresas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_empresa_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- User Roles -> Auth Users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- User Roles -> Empresas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_empresa_id_fkey') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC updated_at
-- =====================================================

DROP TRIGGER IF EXISTS update_categorias_updated_at ON public.categorias;
CREATE TRIGGER update_categorias_updated_at
BEFORE UPDATE ON public.categorias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_comandas_updated_at ON public.comandas;
CREATE TRIGGER update_comandas_updated_at
BEFORE UPDATE ON public.comandas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_empresas_updated_at ON public.empresas;
CREATE TRIGGER update_empresas_updated_at
BEFORE UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_mesas_updated_at ON public.mesas;
CREATE TRIGGER update_mesas_updated_at
BEFORE UPDATE ON public.mesas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER update_pedidos_updated_at
BEFORE UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_produtos_updated_at ON public.produtos;
CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TRIGGER FOR AUTO-CREATE PROFILE ON USER SIGNUP
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_categorias_empresa_id ON public.categorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chamadas_garcom_empresa_id ON public.chamadas_garcom(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_empresa_id ON public.comandas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_mesas_empresa_id ON public.mesas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa_id ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_profiles_empresa_id ON public.profiles(empresa_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_empresa_id ON public.user_roles(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_mesa_id ON public.comandas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_status ON public.comandas(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_comanda_id ON public.pedidos(comanda_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_cozinha ON public.pedidos(status_cozinha);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria_id ON public.produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_mesas_status ON public.mesas(status);
CREATE INDEX IF NOT EXISTS idx_chamadas_garcom_status ON public.chamadas_garcom(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- =====================================================
-- ENABLE REALTIME FOR KEY TABLES (ignore if already added)
-- =====================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chamadas_garcom;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
