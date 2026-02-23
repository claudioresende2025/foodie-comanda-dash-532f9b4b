

# Correcao do Erro "Restaurante nao encontrado" + Imagens nos Produtos

## Problema 1: "Restaurante nao encontrado" ao visualizar cardapio na pagina mesas

### Causa raiz
O arquivo `.env` foi alterado para apontar para o banco de dados externo (`zlwpxflqtyhdwanmupgy`), porem os dados fictícios (empresa, produtos, mesas, etc.) foram inseridos no banco de dados do Lovable Cloud (`jejpufnzaineihemdrgd`). Assim, quando o app tenta buscar a empresa pelo ID no banco externo, ela nao existe la.

### Solucao
Restaurar o `.env` para os valores originais do Lovable Cloud:
- `VITE_SUPABASE_PROJECT_ID` = `jejpufnzaineihemdrgd`
- `VITE_SUPABASE_URL` = `https://jejpufnzaineihemdrgd.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = chave original

Isso fara o app se conectar ao banco onde os dados de teste realmente existem. Apos restaurar, a empresa "Restaurante Sabor & Arte" sera encontrada normalmente.

---

## Problema 2: Inserir imagens nos produtos

### Situacao atual
- A tabela `produtos` ja possui a coluna `imagem_url`
- A pagina de administracao do Cardapio ja possui upload de imagens funcional (upload para o storage "produtos")
- Os 10 produtos de teste criados estao todos sem imagem (`imagem_url = null`)

### Solucao
Atualizar os 10 produtos de teste com URLs de imagens de alimentos reais, usando imagens publicas de alta qualidade. Cada produto recebera uma imagem condizente com seu nome:

| Produto | Imagem |
|---------|--------|
| Bolinho de Bacalhau | Imagem de bolinhos fritos |
| Bruschetta Caprese | Imagem de bruschetta |
| File Mignon ao Molho Madeira | Imagem de file mignon |
| Salmao Grelhado | Imagem de salmao |
| Risoto de Camarao | Imagem de risoto |
| Suco Natural | Imagem de suco |
| Refrigerante Lata | Imagem de refrigerante |
| Caipirinha | Imagem de caipirinha |
| Petit Gateau | Imagem de petit gateau |
| Pudim de Leite | Imagem de pudim |

As imagens serao URLs publicas de bancos de imagem gratuitos (Unsplash/Pexels).

---

## Secao Tecnica

### Arquivo: `.env`
Restaurar para valores originais:
```
VITE_SUPABASE_PROJECT_ID="jejpufnzaineihemdrgd"
VITE_SUPABASE_PUBLISHABLE_KEY="[chave original do Lovable Cloud]"
VITE_SUPABASE_URL="https://jejpufnzaineihemdrgd.supabase.co"
```

### Banco de dados
Executar UPDATE nos 10 produtos para preencher `imagem_url` com URLs publicas de imagens de alimentos.

### Resultado esperado
- Ao clicar em "Visualizar Cardapio" na pagina Mesas, o cardapio abrira normalmente com os produtos e imagens
- Os produtos aparecerao com fotos no cardapio digital e na pagina de administracao

