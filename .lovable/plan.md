

# Correção: Variações de tamanho nos produtos do Menu

## Problema

A coluna `variacoes` **não existe** na tabela `produtos` no banco de dados. A migration `2026_02_05_add_variacoes_produtos.sql` existe como arquivo mas nunca foi executada. Por isso, todos os produtos aparecem sem as opções de Pequena, Média e Grande.

## Solução

### 1. Criar a coluna no banco de dados (migration)

Executar a seguinte SQL via migration:

```sql
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS variacoes JSONB DEFAULT NULL;
COMMENT ON COLUMN produtos.variacoes IS 'Array de variações: [{"nome": "Pequena", "preco": 29.90}, {"nome": "Grande", "preco": 49.90}]';
```

### 2. Popular dados de exemplo (opcional)

Após a coluna existir, os produtos que tinham variações precisarão ser re-cadastrados pelo admin na página Cardápio (que já tem UI para adicionar variações).

## Nenhuma alteração de código necessária

O frontend (`Menu.tsx`, `ProductSizeModal`, `ProductCard`, `useCart`, `Cardapio.tsx`) já está completamente preparado para variações — falta apenas a coluna no banco.

## Resultado

- A coluna `variacoes` será criada
- Produtos cadastrados com variações no painel admin aparecerão com opções de tamanho no menu
- O modal de seleção de tamanho funcionará corretamente

