-- Adicionar coluna user_id na tabela pedidos_delivery para vincular pedidos a clientes
ALTER TABLE public.pedidos_delivery ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_user_id ON public.pedidos_delivery(user_id);

-- Atualizar policy para clientes autenticados verem seus próprios pedidos
DROP POLICY IF EXISTS "Public can view own delivery order" ON public.pedidos_delivery;

CREATE POLICY "Authenticated users can view own delivery orders" 
ON public.pedidos_delivery 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR empresa_id = get_user_empresa_id(auth.uid())
);

-- Atualizar policy de insert para incluir user_id
DROP POLICY IF EXISTS "Allow anon insert pedidos_delivery" ON public.pedidos_delivery;

CREATE POLICY "Allow authenticated insert pedidos_delivery" 
ON public.pedidos_delivery 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() OR user_id IS NULL
);

-- Adicionar coluna user_id na tabela enderecos_cliente para salvar endereços do cliente
ALTER TABLE public.enderecos_cliente ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_enderecos_cliente_user_id ON public.enderecos_cliente(user_id);

-- Atualizar policy para clientes verem seus próprios endereços
DROP POLICY IF EXISTS "Public can view own address" ON public.enderecos_cliente;

CREATE POLICY "Authenticated users can view own addresses" 
ON public.enderecos_cliente 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM pedidos_delivery pd 
    WHERE pd.endereco_id = enderecos_cliente.id 
    AND pd.empresa_id = get_user_empresa_id(auth.uid())
  )
);

-- Atualizar policy de insert
DROP POLICY IF EXISTS "Allow anon insert enderecos_cliente" ON public.enderecos_cliente;

CREATE POLICY "Allow authenticated insert enderecos_cliente" 
ON public.enderecos_cliente 
FOR INSERT 
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);