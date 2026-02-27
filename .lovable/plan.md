

# Implementação do Módulo NFC-e — Código Frontend + Edge Function

O banco de dados já está pronto. Agora falta implementar:

## 1. Página Empresa — Seção Configurações Fiscais
Expandir `src/pages/admin/Empresa.tsx` com nova seção contendo:
- Query para carregar/criar `config_fiscal` da empresa
- Formulário com: Regime Tributário (Select), Código IBGE, Endereço fiscal (Logradouro, Número, Bairro, CEP, UF), API Token, Switch Homologação/Produção, Upload certificado .pfx/.p12, Senha do certificado, CSC e CSC ID
- Mutation para salvar no banco + upload do certificado no bucket `certificados`
- Botão "Salvar Configurações Fiscais" separado do botão existente

## 2. Cardápio — Campo NCM no formulário de produto
Editar `src/pages/admin/Cardapio.tsx`:
- Adicionar campo NCM no `prodForm` state e no formulário do Dialog
- Botões de preenchimento rápido: Lanches `16025000`, Bebidas `22021000`, Cervejas `22030000`, Pizzas `19012090`, Sobremesas `21069090`
- Incluir `ncm` no `handleSaveProduto` (insert/update)
- Exibir NCM no card do produto quando preenchido
- Atualizar tipo `Produto` para incluir `ncm`

## 3. Edge Function `emit-nfce`
Criar `supabase/functions/emit-nfce/index.ts`:
- Recebe: `empresa_id`, itens (com NCM), valores, forma de pagamento, `comanda_id` ou `pedido_delivery_id`
- Busca `config_fiscal` da empresa via service role
- Monta JSON no formato Focus NFe
- Envia para homologação ou produção conforme `modo_producao`
- Salva resultado em `notas_fiscais`
- Retorna status, DANFE URL ou erro SEFAZ
- Configurar `verify_jwt = false` em config.toml e validar auth no código

## 4. Caixa — Botão Emitir NFC-e
Editar `src/pages/admin/Caixa.tsx`:
- Após fechar comanda com sucesso, mostrar botão "Emitir NFC-e"
- Dialog de emissão: resumo dos itens, loading state, resultado
- Chamar edge function `emit-nfce` via `supabase.functions.invoke()`
- Exibir "Visualizar DANFE (PDF)" em caso de sucesso ou erro SEFAZ detalhado

## Seção Técnica
- Não será necessário secret `FOCUS_NFE_TOKEN` global — o token é armazenado por empresa na tabela `config_fiscal.api_token_nfe`
- A edge function usa `SUPABASE_SERVICE_ROLE_KEY` (já existente) para ler `config_fiscal`
- Certificado é lido do bucket `certificados` via storage API dentro da edge function
- Lista de UFs brasileiras hardcoded no Select do formulário fiscal

