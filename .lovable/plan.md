

# Mover API Token e Ambiente para Super Admin com Tabs no Dialog

## Resumo
Ao clicar no restaurante no Super Admin, o dialog atual passará a ter **duas abas (Tabs)**: "Controles do Menu" (overrides existentes) e "Config. API Fiscal" (API Token + Ambiente). Isso é mais limpo que dropdowns com popups encadeados.

## Implementação

### 1. Adicionar Tabs no dialog de empresa (`SuperAdmin.tsx`)
- Adicionar estado para a aba ativa do dialog e estados para os campos fiscais (`apiTokenNfe`, `modoProducao`)
- Ao abrir o dialog, buscar o `config_fiscal` da empresa selecionada
- Substituir o conteúdo atual do dialog por um componente `Tabs` com duas abas:
  - **"Controles"**: conteúdo atual (info da empresa + overrides + limites + botão salvar)
  - **"API Fiscal"**: campos API Token (Focus NFe) + Switch Homologação/Produção + botão salvar
- O save da aba "API Fiscal" faz upsert na tabela `config_fiscal` (apenas `api_token_nfe` e `modo_producao`)

### 2. Remover campos API Token e Ambiente da página Empresa (`ConfigFiscalSection.tsx`)
- Remover os campos `api_token_nfe` e o switch `modo_producao` do formulário do proprietário
- Manter os demais campos fiscais (Regime Tributário, IBGE, Endereço, Certificado, CSC) no `ConfigFiscalSection` conforme preferência do usuário

### 3. RLS: Permitir Super Admin acessar `config_fiscal`
- Migração SQL: adicionar política SELECT e ALL para super_admins na tabela `config_fiscal`
- `USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND ativo = true))`

