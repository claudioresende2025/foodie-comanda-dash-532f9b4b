

# Correção dos Dados e Imagens dos Produtos

## Problema Identificado
Existem duas empresas duplicadas no banco de dados:
- **Empresa A** (`3e3d5937`): "Restaurante sabor e arte" - vinculada ao perfil do usuario, mas SEM produtos, mesas ou categorias
- **Empresa B** (`a1b2c3d4`): "Restaurante Sabor & Arte" - possui os 10 produtos, 4 categorias e 5 mesas, mas NAO esta vinculada ao perfil

Isso causa o erro "restaurante nao encontrado" porque ao acessar o cardapio, o sistema busca os produtos pela empresa do perfil (`3e3d5937`), que nao tem nenhum produto.

## Solucao

### Passo 1: Mover os produtos para a empresa correta
Atualizar todos os registros da empresa `a1b2c3d4` para apontar para `3e3d5937` (a empresa vinculada ao perfil):
- 10 produtos
- 4 categorias
- 5 mesas
- Configuracao de delivery

Apos a migracao, excluir a empresa duplicada `a1b2c3d4`.

### Passo 2: Adicionar imagens nos produtos
Atualizar os 10 produtos com URLs de imagens publicas de alimentos:

| Produto | URL da Imagem |
|---------|---------------|
| Bolinho de Bacalhau | Imagem de bolinhos fritos (Unsplash) |
| Bruschetta Caprese | Imagem de bruschetta (Unsplash) |
| File Mignon ao Molho Madeira | Imagem de file mignon (Unsplash) |
| Salmao Grelhado | Imagem de salmao (Unsplash) |
| Risoto de Camarao | Imagem de risoto (Unsplash) |
| Suco Natural | Imagem de suco (Unsplash) |
| Refrigerante Lata | Imagem de refrigerante (Unsplash) |
| Caipirinha | Imagem de caipirinha (Unsplash) |
| Petit Gateau | Imagem de petit gateau (Unsplash) |
| Pudim de Leite | Imagem de pudim (Unsplash) |

## Resultado Esperado
- O cardapio abrira normalmente com os 10 produtos e suas imagens
- A pagina Mesas mostrara as 5 mesas criadas
- Nao havera mais empresas duplicadas no banco

## Detalhes Tecnicos
Serão executados os seguintes comandos SQL no banco de dados:
1. `UPDATE categorias SET empresa_id = '3e3d5937-...' WHERE empresa_id = 'a1b2c3d4-...'`
2. `UPDATE produtos SET empresa_id = '3e3d5937-...' WHERE empresa_id = 'a1b2c3d4-...'`
3. `UPDATE mesas SET empresa_id = '3e3d5937-...' WHERE empresa_id = 'a1b2c3d4-...'`
4. `UPDATE empresas SET delivery_ativo = true, ... WHERE id = '3e3d5937-...'`
5. `UPDATE produtos SET imagem_url = '...' WHERE id = '...'` (para cada produto)
6. `DELETE FROM empresas WHERE id = 'a1b2c3d4-...'`

Nenhum arquivo de codigo precisa ser alterado.
