-- Migration: Setup automático de mesas e cardápio demo para novos restaurantes
-- Data: 2026-02-25
-- Descrição: Cria automaticamente mesas e um cardápio demo quando uma nova empresa é criada

-- ============================================================================
-- FUNÇÃO: setup_dados_iniciais_empresa
-- Cria mesas demo e cardápio demo para uma nova empresa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.setup_dados_iniciais_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categoria_entradas_id uuid;
  v_categoria_pizzas_id uuid;
  v_categoria_principais_id uuid;
  v_categoria_bebidas_id uuid;
  v_categoria_sobremesas_id uuid;
  v_mesas_count integer;
  i integer;
BEGIN
  -- Verificar se já existem dados para esta empresa (evitar duplicação)
  SELECT COUNT(*) INTO v_mesas_count FROM public.mesas WHERE empresa_id = p_empresa_id;
  
  IF v_mesas_count > 0 THEN
    -- Já existem mesas, não fazer nada
    RETURN;
  END IF;

  -- ============================================================================
  -- CRIAR 5 MESAS DEMO (padrão para novos restaurantes)
  -- ============================================================================
  FOR i IN 1..5 LOOP
    INSERT INTO public.mesas (empresa_id, numero_mesa, capacidade, status)
    VALUES (p_empresa_id, i, 4, 'disponivel');
  END LOOP;

  -- ============================================================================
  -- CRIAR CATEGORIAS DEMO
  -- ============================================================================
  
  -- Categoria: Entradas
  INSERT INTO public.categorias (empresa_id, nome, descricao, ordem, ativo)
  VALUES (p_empresa_id, 'Entradas', 'Aperitivos e entradas deliciosas', 1, true)
  RETURNING id INTO v_categoria_entradas_id;
  
  -- Categoria: Pizzas
  INSERT INTO public.categorias (empresa_id, nome, descricao, ordem, ativo)
  VALUES (p_empresa_id, 'Pizzas', 'Pizzas artesanais com ingredientes selecionados', 2, true)
  RETURNING id INTO v_categoria_pizzas_id;
  
  -- Categoria: Pratos Principais
  INSERT INTO public.categorias (empresa_id, nome, descricao, ordem, ativo)
  VALUES (p_empresa_id, 'Pratos Principais', 'Refeições completas e saborosas', 3, true)
  RETURNING id INTO v_categoria_principais_id;
  
  -- Categoria: Bebidas
  INSERT INTO public.categorias (empresa_id, nome, descricao, ordem, ativo)
  VALUES (p_empresa_id, 'Bebidas', 'Bebidas refrescantes e geladas', 4, true)
  RETURNING id INTO v_categoria_bebidas_id;
  
  -- Categoria: Sobremesas
  INSERT INTO public.categorias (empresa_id, nome, descricao, ordem, ativo)
  VALUES (p_empresa_id, 'Sobremesas', 'Doces e sobremesas irresistíveis', 5, true)
  RETURNING id INTO v_categoria_sobremesas_id;

  -- ============================================================================
  -- CRIAR PRODUTOS DEMO
  -- ============================================================================
  
  -- === ENTRADAS ===
  INSERT INTO public.produtos (empresa_id, categoria_id, nome, descricao, preco, imagem_url, ativo)
  VALUES 
    (p_empresa_id, v_categoria_entradas_id, 'Batata Frita Rústica', 
     'Batatas cortadas em gomos, fritas até ficarem crocantes, temperadas com ervas finas e sal marinho.', 
     28.90, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_entradas_id, 'Batata com Bacon e Cheddar', 
     'Porção generosa de batatas fritas cobertas com bacon crocante e molho cheddar cremoso.', 
     38.90, 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_entradas_id, 'Mix de Mini Coxinhas', 
     '12 mini coxinhas sortidas: frango, carne seca e queijo. Acompanha molho especial.', 
     42.90, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop', true);

  -- === PIZZAS ===
  INSERT INTO public.produtos (empresa_id, categoria_id, nome, descricao, preco, imagem_url, ativo)
  VALUES 
    (p_empresa_id, v_categoria_pizzas_id, 'Calabresa Especial', 
     'Molho de tomate artesanal, mussarela, calabresa fatiada, cebola roxa e orégano fresco.', 
     59.90, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_pizzas_id, 'Margherita com Manjericão Fresco', 
     'Molho de tomate italiano, mussarela de búfala, tomate cereja e manjericão fresco.', 
     54.90, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_pizzas_id, 'Quatro Queijos Premium', 
     'Mussarela, gorgonzola, provolone e parmesão, finalizados com mel trufado.', 
     69.90, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop', true);

  -- === PRATOS PRINCIPAIS ===
  INSERT INTO public.produtos (empresa_id, categoria_id, nome, descricao, preco, imagem_url, ativo)
  VALUES 
    (p_empresa_id, v_categoria_principais_id, 'Filé Mignon ao Molho Madeira', 
     'Medalhão de filé mignon grelhado ao ponto, molho madeira com cogumelos. Acompanha arroz e batatas.', 
     89.90, 'https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_principais_id, 'Salmão Grelhado com Risoto', 
     'Filé de salmão grelhado na manteiga de ervas, servido com risoto de limão siciliano.', 
     98.90, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_principais_id, 'Picanha na Chapa', 
     '300g de picanha na chapa com alho dourado. Acompanha arroz, feijão tropeiro e vinagrete.', 
     79.90, 'https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=400&h=300&fit=crop', true);

  -- === BEBIDAS ===
  INSERT INTO public.produtos (empresa_id, categoria_id, nome, descricao, preco, imagem_url, ativo)
  VALUES 
    (p_empresa_id, v_categoria_bebidas_id, 'Sucos Naturais', 
     'Suco natural de laranja ou limão (500ml). Feito na hora com frutas selecionadas.', 
     14.90, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_bebidas_id, 'Refrigerantes Lata', 
     'Coca-Cola, Guaraná Antarctica, Sprite ou Fanta (350ml).', 
     8.90, 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_bebidas_id, 'Água Mineral', 
     'Água mineral sem gás ou com gás (500ml).', 
     6.90, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_bebidas_id, 'Cervejas Artesanais', 
     'Seleção de cervejas artesanais locais: IPA, Pilsen e Weiss (473ml).', 
     22.90, 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&h=300&fit=crop', true);

  -- === SOBREMESAS ===
  INSERT INTO public.produtos (empresa_id, categoria_id, nome, descricao, preco, imagem_url, ativo)
  VALUES 
    (p_empresa_id, v_categoria_sobremesas_id, 'Petit Gâteau', 
     'Bolinho de chocolate com coração derretido, servido com sorvete de baunilha e calda de frutas vermelhas.', 
     32.90, 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_sobremesas_id, 'Picolés Frutados', 
     'Duo de picolés artesanais de frutas da estação. Sabores rotativos.', 
     16.90, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop', true),
    
    (p_empresa_id, v_categoria_sobremesas_id, 'Pudim de Leite Condensado', 
     'Pudim caseiro tradicional com calda de caramelo. Receita da vovó.', 
     18.90, 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400&h=300&fit=crop', true);

END;
$$;

-- Permissão para chamada da função
GRANT EXECUTE ON FUNCTION public.setup_dados_iniciais_empresa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_dados_iniciais_empresa(uuid) TO service_role;

-- ============================================================================
-- TRIGGER: Executar setup automaticamente quando nova empresa é criada
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_setup_empresa_dados_iniciais()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Chamar a função de setup para a nova empresa
  PERFORM public.setup_dados_iniciais_empresa(NEW.id);
  RETURN NEW;
END;
$$;

-- Remover trigger se já existir
DROP TRIGGER IF EXISTS trigger_criar_dados_iniciais_empresa ON public.empresas;

-- Criar trigger para executar após inserção de nova empresa
CREATE TRIGGER trigger_criar_dados_iniciais_empresa
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.trigger_setup_empresa_dados_iniciais();

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON FUNCTION public.setup_dados_iniciais_empresa(uuid) IS 
  'Cria automaticamente 5 mesas e um cardápio demo (5 categorias, 16 produtos) para uma nova empresa';

COMMENT ON TRIGGER trigger_criar_dados_iniciais_empresa ON public.empresas IS 
  'Trigger que executa o setup de dados iniciais quando uma nova empresa é criada';
