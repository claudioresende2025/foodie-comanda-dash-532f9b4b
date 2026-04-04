# 🔄 GUIA DE SINCRONIZAÇÃO DO BANCO DE DADOS

## 📊 Status Atual

Após análise do banco de dados, identificamos:

- ✅ **5 tabelas completas** e funcionando
- ⚠️ **14 tabelas vazias** (criadas mas sem dados)
- ⚠️ **4 tabelas incompletas** (faltam colunas)
- ❌ **14 tabelas faltando** (precisam ser criadas)

---

## ❌ Tabelas que NÃO EXISTEM (Prioridade Alta)

Estas tabelas precisam ser criadas urgentemente:

1. `cupons_uso` - Rastreio de uso de cupons
2. `promocao_itens` - Itens em promoções
3. `fidelidade_transacoes` - Histórico de pontos de fidelidade
4. `chat_conversas` - Sistema de chat
5. `chat_mensagens` - Mensagens do chat
6. `notificacoes_push` - Notificações push
7. `password_reset_tokens` - Tokens de reset de senha
8. `delivery_tracking` - Rastreamento de entrega
9. `analytics_eventos` - Eventos de analytics
10. `relatorio_vendas_diarias` - Relatório de vendas
11. `relatorio_produtos_vendidos` - Produtos mais vendidos
12. `relatorio_horarios_pico` - Horários de pico
13. `relatorio_clientes_inativos` - Clientes inativos
14. `relatorio_fidelidade_clientes` - Relatório de fidelidade

---

## ⚠️ Tabelas INCOMPLETAS (Precisam de Ajustes)

### 1. `empresas`
- **Colunas extras no banco:** `slug`, `ativo`, `usuario_id`
- **Ação:** Pode manter (não conflitam com o schema)

### 2. `comandas`
- **Faltam colunas:** `telefone_cliente`, `comanda_mestre_id`, `updated_at`
- **Ação:** Adicionar estas colunas

### 3. `config_delivery`
- **Faltam colunas:** `valor_minimo_pedido`, `ativo`, `dias_funcionamento`
- **Colunas extras:** `delivery_ativo`, `pedido_minimo`, `aceita_pix`
- **Ação:** Adicionar as colunas faltantes

### 4. `itens_delivery`
- **Faltam colunas:** `created_at`
- **Ação:** Adicionar a coluna

---

## 🚀 COMO EXECUTAR A SINCRONIZAÇÃO

### Método 1: Supabase Dashboard (RECOMENDADO)

#### Passo 1: Acesse o Dashboard
```
https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/sql/new
```

#### Passo 2: Execute a Migração Completa

1. Abra o arquivo: `supabase/migrations/20260102_complete_sync.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em "Run" (ou pressione Ctrl/Cmd + Enter)

Este arquivo contém:
- ✅ Criação de TODAS as tabelas com `IF NOT EXISTS`
- ✅ Todas as políticas RLS
- ✅ Todos os índices
- ✅ Todos os triggers
- ✅ Funções RPC úteis

**É SEGURO executar múltiplas vezes!** O script não irá sobrescrever dados existentes.

---

### Método 2: Via Arquivos Individuais

Se preferir aplicar as migrações uma por uma (útil para debug):

#### 2.1 Migrações já aplicadas ✅
```bash
# Estas já foram aplicadas no seu banco:
✅ 20251204023331_*.sql
✅ 20251204032418_*.sql
✅ 20251204033501_*.sql
✅ 20251206014142_*.sql
✅ 20251206015826_*.sql
✅ 20251210022413_*.sql
✅ 20251212020530_*.sql
✅ 20251214120024_*.sql
✅ 20251215014357_*.sql
✅ 20251218004845_*.sql
✅ 20251223012734_*.sql
✅ 20251223013429_*.sql
# ... (total: 22 migrações)
```

#### 2.2 Migrações FALTANDO ❌
Execute estes arquivos NO Supabase Dashboard:

```bash
1. supabase/migrations/20260102_chat_notifications.sql
   └─ Cria: chat_conversas, chat_mensagens, notificacoes_push

2. supabase/migrations/20260102_cupons_fidelidade_system.sql
   └─ Cria: cupons_uso, fidelidade_transacoes, promocao_itens

3. supabase/migrations/20260102_endereco_seguranca.sql
   └─ Cria: password_reset_tokens, delivery_tracking

4. supabase/migrations/20260102_metricas_relatorios.sql
   └─ Cria: analytics_eventos, relatorio_* (5 tabelas)
```

---

## 🔧 SCRIPTS AUXILIARES

### Verificar Status Novamente
```bash
node sync-database.js
```

### Verificação Avançada (com detalhes de colunas)
```bash
node sync-database-advanced.js
```

### Ver Relatório Detalhado
```bash
cat database-sync-report.json
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

Após executar as migrações, verifique:

- [ ] Todas as 37 tabelas existem
- [ ] Tabela `cupons_uso` existe
- [ ] Tabela `promocao_itens` existe
- [ ] Tabela `fidelidade_transacoes` existe
- [ ] Tabelas de chat existem
- [ ] Tabelas de relatórios existem
- [ ] Coluna `telefone_cliente` existe em `comandas`
- [ ] Coluna `comanda_mestre_id` existe em `comandas`
- [ ] Coluna `created_at` existe em `itens_delivery`
- [ ] Execute novamente: `node sync-database.js`
- [ ] Verifique se aparecem "✅ Todas as tabelas estão sincronizadas!"

---

## 🔗 Links Úteis

- **Dashboard Principal:** https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy
- **SQL Editor:** https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/sql/new
- **Table Editor:** https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/editor
- **Database:** https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/database/tables

---

## ⚡ QUICK START (Mais Rápido)

```bash
# 1. Copie o SQL completo para o clipboard
cat supabase/migrations/20260102_complete_sync.sql | pbcopy  # Mac
cat supabase/migrations/20260102_complete_sync.sql | xclip -selection clipboard  # Linux

# 2. Abra o SQL Editor
open "https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/sql/new"

# 3. Cole (Cmd+V / Ctrl+V) e Execute (Cmd+Enter / Ctrl+Enter)

# 4. Verifique
node sync-database.js
```

---

## 🆘 Problemas Comuns

### Erro: "relation already exists"
✅ **Normal!** O script usa `IF NOT EXISTS`, apenas continue.

### Erro: "permission denied"
❌ Você precisa usar a Service Role Key ou ter permissões de admin no projeto.

### Erro: "syntax error"
❌ Certifique-se de copiar TODO o arquivo SQL, desde o início até o final.

### Algumas tabelas ainda não aparecem
1. Aguarde 30 segundos (cache do Supabase)
2. Atualize a página do dashboard
3. Execute `node sync-database.js` novamente

---

## ✅ Próximos Passos Após Sincronização

1. **Teste a conexão:**
   ```bash
   node sync-database.js
   ```

2. **Popule dados iniciais** (se necessário):
   - Crie empresa de teste
   - Adicione categorias
   - Cadastre produtos

3. **Configure RLS** (se precisar ajustar):
   - Acesse: Database > Policies
   - Verifique as políticas de cada tabela

4. **Teste a aplicação:**
   ```bash
   npm run dev
   ```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique o arquivo `database-sync-report.json`
2. Execute `node sync-database-advanced.js` para diagnóstico detalhado
3. Verifique os logs no Supabase Dashboard > Logs

---

**Última atualização:** 2026-01-02
**Versão do Schema:** Lovable Sync v1.0
