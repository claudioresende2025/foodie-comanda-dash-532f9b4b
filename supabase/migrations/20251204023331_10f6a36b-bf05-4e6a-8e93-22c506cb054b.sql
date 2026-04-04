-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum para funções de usuário
CREATE TYPE public.app_role AS ENUM ('proprietario', 'gerente', 'garcom', 'caixa');

-- Enum para status de mesa
CREATE TYPE public.mesa_status AS ENUM ('disponivel', 'ocupada', 'reservada', 'juncao');

-- Enum para status de comanda
CREATE TYPE public.comanda_status AS ENUM ('aberta', 'fechada', 'cancelada');

-- Enum para status de pedido na cozinha
CREATE TYPE public.pedido_status AS ENUM ('pendente', 'preparando', 'pronto', 'entregue', 'cancelado');

-- Tabela de Empresas
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia TEXT NOT NULL,
  usuario_proprietario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cnpj TEXT,
  endereco_completo TEXT,
  inscricao_estadual TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Perfis de Usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Roles de Usuários (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id, role)
);

-- Tabela de Categorias de Produtos
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  imagem_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Mesas
CREATE TABLE public.mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_mesa INT NOT NULL,
  status mesa_status DEFAULT 'disponivel',
  capacidade INT DEFAULT 4,
  mesa_juncao_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero_mesa)
);

-- Tabela de Comandas
CREATE TABLE public.comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  status comanda_status DEFAULT 'aberta',
  qr_code_sessao TEXT UNIQUE,
  nome_cliente TEXT,
  telefone_cliente TEXT,
  comanda_mestre_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
  total DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Pedidos
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  quantidade INT NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  status_cozinha pedido_status DEFAULT 'pendente',
  notas_cliente TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS em todas as tabelas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Função Security Definer para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _empresa_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND empresa_id = _empresa_id
      AND role = _role
  )
$$;

-- Função para obter empresa_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_empresa_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- Função para verificar se usuário pertence à empresa
CREATE OR REPLACE FUNCTION public.user_belongs_to_empresa(_user_id UUID, _empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND empresa_id = _empresa_id
  )
$$;

-- RLS Policies para Empresas
CREATE POLICY "Usuários podem ver sua própria empresa"
ON public.empresas FOR SELECT
TO authenticated
USING (
  id = public.get_user_empresa_id(auth.uid())
  OR usuario_proprietario_id = auth.uid()
);

CREATE POLICY "Proprietários podem criar empresas"
ON public.empresas FOR INSERT
TO authenticated
WITH CHECK (usuario_proprietario_id = auth.uid());

CREATE POLICY "Proprietários podem atualizar sua empresa"
ON public.empresas FOR UPDATE
TO authenticated
USING (usuario_proprietario_id = auth.uid());

-- RLS Policies para Profiles
CREATE POLICY "Usuários podem ver perfis da mesma empresa"
ON public.profiles FOR SELECT
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid())
  OR id = auth.uid()
);

CREATE POLICY "Usuários podem criar próprio perfil"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Usuários podem atualizar próprio perfil"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- RLS Policies para User Roles
CREATE POLICY "Ver roles da própria empresa"
ON public.user_roles FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- *** CORREÇÃO: Política para permitir o Onboarding do Proprietário ***
CREATE POLICY "Usuário pode atribuir role a si mesmo (Onboarding)"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- Esta política agora lida com o Gerenciamento de Equipe e outras alterações
CREATE POLICY "Proprietários podem gerenciar roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas
    WHERE id = empresa_id
    AND usuario_proprietario_id = auth.uid()
  )
);

-- RLS Policies para Categorias
CREATE POLICY "Ver categorias da empresa"
ON public.categorias FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Gerenciar categorias da empresa"
ON public.categorias FOR ALL
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()))
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- RLS Policies para Produtos
CREATE POLICY "Ver produtos da empresa"
ON public.produtos FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Gerenciar produtos da empresa"
ON public.produtos FOR ALL
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()))
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- RLS Policies para Mesas
CREATE POLICY "Ver mesas da empresa"
ON public.mesas FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Gerenciar mesas da empresa"
ON public.mesas FOR ALL
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()))
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- RLS Policies para Comandas
CREATE POLICY "Ver comandas da empresa"
ON public.comandas FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Gerenciar comandas da empresa"
ON public.comandas FOR ALL
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()))
WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- RLS Policies para Pedidos (via comanda)
CREATE POLICY "Ver pedidos via comanda"
ON public.pedidos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.comandas
    WHERE comandas.id = pedidos.comanda_id
    AND comandas.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Gerenciar pedidos via comanda"
ON public.pedidos FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.comandas
    WHERE comandas.id = pedidos.comanda_id
    AND comandas.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categorias_updated_at BEFORE UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mesas_updated_at BEFORE UPDATE ON public.mesas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comandas_updated_at BEFORE UPDATE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente
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
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket para logos e imagens de produtos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('produtos', 'produtos', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Logos são públicas para visualização"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Usuários autenticados podem fazer upload de logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Usuários podem atualizar suas logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos');

CREATE POLICY "Produtos são públicos para visualização"
ON storage.objects FOR SELECT
USING (bucket_id = 'produtos');

CREATE POLICY "Usuários autenticados podem fazer upload de imagens de produtos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'produtos');

CREATE POLICY "Usuários podem atualizar imagens de produtos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'produtos');