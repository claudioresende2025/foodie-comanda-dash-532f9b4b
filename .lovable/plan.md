

# Plano: Faturamento com Vendas Avulsas + Onboarding Condicional + Botão Atualizar + Relatório Vendas Avulsas

## Alterações

### 1. Incluir vendas avulsas no faturamento (`src/pages/admin/Dashboard.tsx`)
- Adicionar query para `vendas_concluidas` onde `comanda_id IS NULL` no cálculo de `faturamentoHoje` (stats do dia)
- Incluir vendas avulsas no gráfico de 7 dias (`dailySales`)
- Somar `valor_total` das vendas avulsas ao total de comandas fechadas

### 2. Incluir vendas avulsas no ValueMetrics (`src/components/admin/ValueMetrics.tsx`)
- Adicionar query paralela para `vendas_concluidas` (comanda_id IS NULL) do mês atual e anterior
- Somar ao faturamento mensal

### 3. Incluir vendas avulsas no TrialValueBanner (`src/components/admin/TrialValueBanner.tsx`)
- Mesmo ajuste: somar vendas avulsas ao faturamento total do trial

### 4. Onboarding condicional (`src/components/admin/OnboardingChecklist.tsx`)
- Atualmente o card "Parabéns" aparece sempre quando todos os passos estão completos
- Mudar para: salvar em `localStorage` uma flag `onboarding_completed_[empresaId]` quando todos os passos forem completados pela primeira vez
- Na próxima vez que o usuário abrir o Dashboard, se a flag existir, retornar `null` (não renderizar nada)
- O "Parabéns" só aparece uma vez, na sessão em que o usuário completa tudo

### 5. Botão de atualizar no Dashboard (`src/pages/admin/Dashboard.tsx`)
- Adicionar um botão pequeno com ícone `RefreshCw` ao lado dos botões Excel/PDF no header
- Ao clicar, invalidar todas as queries do Dashboard (`queryClient.invalidateQueries`)

### 6. Botão de relatório de vendas avulsas (`src/pages/admin/Dashboard.tsx`)
- Adicionar botão "Vendas Avulsas" ao lado dos botões de exportação
- Ao clicar, buscar vendas avulsas dos últimos 7 dias na tabela `vendas_concluidas` (comanda_id IS NULL)
- Exportar como CSV com colunas: Data, Valor, Forma de Pagamento

**Total: 4 arquivos alterados**

