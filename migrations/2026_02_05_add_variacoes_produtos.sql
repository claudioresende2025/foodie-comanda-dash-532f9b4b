-- Migration: Adicionar coluna variacoes na tabela produtos
-- Data: 2026-02-05
-- Descrição: Adiciona suporte a variações de tamanho (ex: Pequena, Média, Grande) com preços diferentes

-- Adicionar coluna variacoes como JSONB (permite armazenar array de objetos)
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS variacoes JSONB DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN produtos.variacoes IS 'Array de variações de tamanho no formato: [{"nome": "Pequena", "preco": 29.90}, {"nome": "Grande", "preco": 49.90}]';

-- Exemplo de uso:
-- UPDATE produtos SET variacoes = '[{"nome": "Pequena", "preco": 29.90}, {"nome": "Média", "preco": 39.90}, {"nome": "Grande", "preco": 49.90}]'::jsonb WHERE id = 'seu-produto-id';

-- Para buscar produtos com variações:
-- SELECT * FROM produtos WHERE variacoes IS NOT NULL AND jsonb_array_length(variacoes) > 0;

-- Para buscar o menor preço de um produto com variações:
-- SELECT nome, 
--   CASE 
--     WHEN variacoes IS NOT NULL AND jsonb_array_length(variacoes) > 0 
--     THEN (SELECT MIN((elem->>'preco')::numeric) FROM jsonb_array_elements(variacoes) elem)
--     ELSE preco 
--   END as menor_preco
-- FROM produtos;
