

# Plano: Corrigir faturamento e relatório de vendas avulsas

## Problema

As vendas avulsas são registradas na tabela `vendas_concluidas`, mas o Dashboard consulta apenas a tabela `comandas`. O relatório de vendas avulsas também busca em `comandas` (com `mesa_id IS NULL`) em vez de `vendas_concluidas`.

## Alterações

### 1. Dashboard - Faturamento hoje (`src/pages/admin/Dashboard.tsx`)
- Adicionar query para `vendas_concluidas` do dia atual (filtrado por `empresa_id`)
- No `useMemo` de stats, somar `valor_total` das vendas concluídas ao `faturamentoHoje`

### 2. Dashboard - Gráfico 7 dias (`src/pages/admin/Dashboard.tsx`)
- Na query `daily-sales`, buscar também `vendas_concluidas` dos últimos 7 dias
- Somar `valor_total` ao total diário de cada dia no gráfico

### 3. Dashboard - Relatório Vendas Avulsas (`src/pages/admin/Dashboard.tsx`)
- Corrigir `handleExportVendasAvulsas`: trocar consulta de `comandas` para `vendas_concluidas`
- Usar colunas corretas: `valor_total`, `forma_pagamento`, `created_at`

### 4. ValueMetrics - Faturamento mensal (`src/components/admin/ValueMetrics.tsx`)
- Adicionar query paralela para `vendas_concluidas` do mês atual e anterior
- Somar ao faturamento mensal de comandas

### 5. TrialValueBanner (`src/components/admin/TrialValueBanner.tsx`)
- Mesmo ajuste: somar vendas de `vendas_concluidas` ao faturamento do trial

**Total: 3 arquivos alterados**

