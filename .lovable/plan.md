

# Módulo Completo de Emissão de NFC-e

## Resumo
Implementar emissão de NFC-e integrada à Focus NFe API, com configurações fiscais na página Empresa, NCM nos produtos, e botão de emissão no Caixa.

## Alterações no Banco de Dados

### 1. Nova tabela `config_fiscal` (por empresa)
```sql
CREATE TABLE config_fiscal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  regime_tributario TEXT DEFAULT 'simples_nacional',
  codigo_ibge_cidade TEXT,
  logradouro TEXT, numero TEXT, bairro TEXT, cep TEXT, uf TEXT DEFAULT 'SP',
  api_token_nfe TEXT,
  modo_producao BOOLEAN DEFAULT false,
  certificado_path TEXT,
  certificado_senha TEXT,
  csc TEXT, csc_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id)
);
-- RLS: staff da empresa pode ler/escrever
```

### 2. Nova tabela `notas_fiscais` (histórico)
```sql
CREATE TABLE notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  comanda_id UUID REFERENCES comandas(id),
  pedido_delivery_id UUID REFERENCES pedidos_delivery(id),
  numero_nota TEXT, serie TEXT, chave_acesso TEXT,
  status TEXT DEFAULT 'pendente',
  danfe_url TEXT,
  xml_url TEXT,
  valor_total NUMERIC,
  erro_sefaz TEXT,
  api_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: staff da empresa
```

### 3. Adicionar coluna `ncm` na tabela `produtos`
```sql
ALTER TABLE produtos ADD COLUMN ncm TEXT;
```

### 4. Novo bucket de storage `certificados` (privado)

## Alterações no Frontend

### 1. Página Empresa (`src/pages/admin/Empresa.tsx`)
Adicionar nova seção **"Configurações Fiscais / NFC-e"** com:
- **Dados fiscais**: Regime Tributário (Select: Simples Nacional, Lucro Presumido, Lucro Real), Código IBGE da Cidade
- **Endereço fiscal**: Logradouro, Número, Bairro, CEP, UF (Select com 27 estados)
- **Credenciais API**: Campo API Token (Focus NFe), Switch Homologação/Produção
- **Certificado Digital A1**: Upload .pfx/.p12, campo senha (password), indicador de status
- **Chaves SEFAZ**: CSC e ID do CSC
- Botão "Salvar Configurações Fiscais" separado

### 2. Cadastro de Produtos (`src/pages/admin/Cardapio.tsx`)
- Adicionar campo **NCM** (8 dígitos) no formulário de produto
- Botões de preenchimento rápido com NCMs comuns:
  - Lanches: `16025000` | Bebidas: `22021000` | Cervejas: `22030000` | Pizzas: `19012090` | Sobremesas: `21069090`
- Exibir NCM no card do produto quando preenchido

### 3. Tela do Caixa (`src/pages/admin/Caixa.tsx`)
- Após `handleFinalizarPagamento`, adicionar botão **"Emitir NFC-e"**
- Dialog de emissão com resumo dos itens e status
- Exibir resultado: botão "Visualizar DANFE (PDF)" ou mensagem de erro SEFAZ
- Salvar nota na tabela `notas_fiscais`

### 4. Nova Edge Function `emit-nfce`
- Recebe dados da venda (itens com NCM, valores, forma de pagamento, dados da empresa)
- Monta JSON no formato Focus NFe
- Envia para `https://homologacao.focusnfe.com.br/v2/nfce` (homologação) ou produção
- Retorna status, DANFE URL, chave de acesso ou erro
- Usa `FOCUS_NFE_TOKEN` como secret (a ser configurado pelo usuário)

### 5. Sidebar — nenhuma alteração necessária
O módulo fiscal fica integrado nas páginas existentes (Empresa, Cardápio, Caixa).

## Seção Técnica

### Fluxo de emissão
1. Usuário fecha comanda no Caixa → clica "Emitir NFC-e"
2. Frontend coleta: itens (com NCM), totais, forma de pagamento, dados fiscais da empresa
3. Chama edge function `emit-nfce` com payload
4. Edge function consulta `config_fiscal` para dados do emitente
5. Monta JSON Focus NFe, envia à API
6. Salva resultado em `notas_fiscais`
7. Retorna ao frontend: sucesso (DANFE link) ou erro (mensagem SEFAZ)

### Sandbox/Homologação
- Modo homologação usa endpoint `homologacao.focusnfe.com.br` — testes ilimitados e gratuitos
- Não requer certificado real (Focus NFe aceita assinatura de teste em homologação)
- Switch na config fiscal controla qual endpoint é usado

### Secret necessário
- `FOCUS_NFE_TOKEN`: API token da Focus NFe (será solicitado ao usuário via ferramenta de secrets)

