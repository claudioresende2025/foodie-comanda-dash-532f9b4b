

# Plano de Implementacao: Estrategia de Aquisicao e Conversao para Restaurantes

## Resumo

Implementar um conjunto de recursos focados em atrair, converter e reter clientes restaurantes, transformando a pagina de planos atual em uma maquina de vendas completa com landing page, programa de indicacao, onboarding guiado e gatilhos de conversao in-app.

---

## Fase 1: Landing Page de Vendas (`/para-restaurantes`)

**Objetivo:** Criar uma pagina de entrada persuasiva para visitantes que ainda nao conhecem o sistema.

### O que sera criado:
- Novo arquivo `src/pages/LandingRestaurantes.tsx`
- Nova rota `/para-restaurantes` em `App.tsx`
- Secoes da pagina:
  1. **Hero**: Titulo impactante + subtitulo + CTA "Teste Gratis por 14 dias" + screenshot do dashboard
  2. **Problemas**: 3-4 dores comuns de donos de restaurante (controle manual, perda de pedidos, falta de visibilidade)
  3. **Solucao**: Como o sistema resolve cada dor, com icones e descricoes curtas
  4. **Funcionalidades**: Grid visual dos modulos (Cardapio Digital, Comandas, KDS, Delivery, Caixa, Marketing)
  5. **Depoimentos**: 3 cards com depoimentos ficticios (estrutura pronta para dados reais depois)
  6. **Antes x Depois**: Comparacao visual do dia-a-dia sem e com o sistema
  7. **Precos**: Embed dos 3 planos atuais (reutilizando logica de `Planos.tsx`)
  8. **FAQ**: Accordion com 6-8 perguntas frequentes
  9. **CTA Final**: "Comece agora - sem cartao de credito"
  10. **Footer**: Links, contato, redes sociais

### Alteracoes:
| Arquivo | Mudanca |
|---------|---------|
| `src/pages/LandingRestaurantes.tsx` | Novo arquivo |
| `src/App.tsx` | Nova rota `/para-restaurantes` |

---

## Fase 2: Trial Gratuito Aprimorado (14 dias, sem cartao)

**Objetivo:** Remover friccao na entrada. O usuario testa tudo antes de pagar.

### Alteracoes:

1. **Onboarding (`src/pages/admin/Onboarding.tsx`)**:
   - Mudar trial de 3 para 14 dias (`trialEnd = 14 * 24 * 60 * 60 * 1000`)
   - Adicionar dados de exemplo automaticos ao criar empresa:
     - 3 categorias de exemplo (Entradas, Pratos Principais, Bebidas)
     - 6 produtos de exemplo com precos
     - 2 mesas de exemplo
   - Isso permite que o usuario explore o sistema imediatamente

2. **Pagina de Planos (`src/pages/Planos.tsx`)**:
   - Alterar banner de "3 dias gratis" para "14 dias gratis"
   - Adicionar texto "Sem cartao de credito" abaixo do CTA
   - Adicionar selo de garantia de 7 dias apos assinatura

3. **Migracoes SQL**:
   - Atualizar `trial_days` dos planos para 14 dias

---

## Fase 3: Onboarding Wizard (Checklist Interativo)

**Objetivo:** Guiar o usuario nos primeiros passos para garantir que ele perceba valor rapidamente.

### O que sera criado:

- Novo componente `src/components/admin/OnboardingChecklist.tsx`
- Exibido no Dashboard como um card fixo enquanto nao concluir todos os passos

### Passos do checklist:
1. Cadastrar empresa (auto-completado no onboarding)
2. Criar primeira categoria no cardapio
3. Adicionar primeiro produto
4. Criar primeira mesa
5. Simular um pedido
6. Configurar forma de pagamento (PIX)

### Logica:
- Cada passo verifica dados reais no banco (ex: `SELECT COUNT(*) FROM produtos WHERE empresa_id = ?`)
- Barra de progresso visual (0% a 100%)
- Ao completar 100%, exibe confetti/animacao + mensagem de parabens
- Armazenado em `localStorage` para nao verificar toda vez (mas com botao "atualizar")

### Alteracoes:
| Arquivo | Mudanca |
|---------|---------|
| `src/components/admin/OnboardingChecklist.tsx` | Novo arquivo |
| `src/pages/admin/Dashboard.tsx` | Renderizar checklist quando incompleto |

---

## Fase 4: Gatilhos de Conversao In-App

**Objetivo:** Mostrar o valor que o sistema gera para motivar a assinatura antes do trial acabar.

### 4.1 Banner de Valor no Dashboard

Novo componente `src/components/admin/TrialValueBanner.tsx`:

- Exibido apenas durante o trial
- Mostra metricas do uso: "Voce ja gerenciou X pedidos e R$ Y,YY em vendas com o sistema"
- Nos ultimos 3 dias do trial: muda para urgencia "Seu trial expira em X dias - Assine agora"
- Link direto para `/planos`

### 4.2 Soft Limits e Upsell

Modificar `src/components/admin/AdminSidebar.tsx` e `src/components/UpgradeModal.tsx`:

- Quando usuario no plano Basico tenta acessar Marketing: mostra modal de upgrade (ja existe)
- Adicionar contador visual: "Voce usou 8 de 10 mesas disponiveis" no card de Mesas
- Ao atingir 80% do limite: badge amarelo de aviso
- Ao atingir 100%: bloqueio com modal de upgrade

### Alteracoes:
| Arquivo | Mudanca |
|---------|---------|
| `src/components/admin/TrialValueBanner.tsx` | Novo arquivo |
| `src/pages/admin/Dashboard.tsx` | Renderizar TrialValueBanner |
| `src/pages/admin/Mesas.tsx` | Adicionar contador de uso vs limite |

---

## Fase 5: Programa de Indicacao

**Objetivo:** Crescimento organico - clientes trazem outros clientes.

### Migracoes SQL:

```sql
CREATE TABLE public.indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_indicadora_id uuid NOT NULL REFERENCES empresas(id),
  codigo_indicacao text UNIQUE NOT NULL,
  empresa_indicada_id uuid REFERENCES empresas(id),
  status text NOT NULL DEFAULT 'pendente',
  -- 'pendente', 'convertida', 'recompensada'
  recompensa_aplicada boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  convertida_at timestamptz
);
```

### Logica:
- Cada empresa ganha um codigo unico (ex: `REF-SABOR123`)
- Codigo gerado automaticamente no onboarding (baseado no nome da empresa)
- Quando alguem se cadastra usando o codigo:
  - Indicado ganha 7 dias extras de trial
  - Indicador ganha 1 mes de desconto (credito na proxima fatura)
- Painel de indicacoes na pagina de Assinatura ou Marketing

### O que sera criado:
| Arquivo | Descricao |
|---------|-----------|
| `src/components/admin/ReferralCard.tsx` | Card com codigo, link copiavel, QR code, contador de indicacoes |
| `src/pages/admin/Marketing.tsx` | Nova aba "Indicacoes" no modulo Marketing |
| Migracao SQL | Tabela `indicacoes` + RLS |

### Fluxo:
1. Restaurante A compartilha link `foodiecomanda.app/planos?ref=REF-SABOR123`
2. Restaurante B acessa, faz trial, assina
3. Sistema marca indicacao como "convertida"
4. Restaurante A recebe notificacao + credito

---

## Fase 6: Emails Automaticos de Conversao

**Objetivo:** Nutrir o lead durante o trial com emails que educam e convertem.

### Sequencia de emails (usando Edge Function `send-email` ja existente):

| Dia | Email | Conteudo |
|-----|-------|----------|
| 0 | Boas-vindas | "Bem-vindo! Aqui esta como comecar em 5 minutos" |
| 3 | Dica 1 | "Voce ja criou seu cardapio digital? Veja como" |
| 7 | Meio do trial | "Metade do seu trial! Veja o que voce ja conquistou" |
| 11 | Urgencia | "Faltam 3 dias! Nao perca seus dados" |
| 14 | Expiracao | "Seu trial expirou. Assine com 20% de desconto" |
| 21 | Reengajamento | "Sentimos sua falta! Volte com 30 dias gratis" |

### Implementacao:
- Nova Edge Function `trial-email-sequence` (cron diario, similar a `trial-reminder-cron` ja existente)
- Adicionar coluna `trial_emails_sent` (jsonb) na tabela `assinaturas` para rastrear quais emails ja foram enviados
- Novos templates HTML na Edge Function `send-email`

### Alteracoes:
| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/trial-email-sequence/index.ts` | Novo - cron de emails |
| `supabase/functions/send-email/index.ts` | Novos templates de email |
| Migracao SQL | Coluna `trial_emails_sent` em `assinaturas` |

---

## Fase 7: Pagina de Planos Otimizada

**Objetivo:** Aumentar conversao na pagina `/planos` com elementos de prova social e urgencia.

### Melhorias em `src/pages/Planos.tsx`:

1. **Secao de depoimentos** abaixo dos cards de planos (3 depoimentos com foto, nome, restaurante)
2. **Selo de garantia** "7 dias de garantia ou seu dinheiro de volta" com icone de escudo
3. **Contador de clientes** "Mais de 500 restaurantes ja usam" (numero dinamico, pode comecar estatico)
4. **Comparacao antes/depois** em cards visuais
5. **Desconto de primeiro pagamento** badge "20% OFF no primeiro mes" para trials expirando
6. **FAQ expandido** com perguntas sobre cancelamento, suporte, migracao de dados

---

## Fase 8: Metricas e Dashboard de Valor

**Objetivo:** Mostrar ao usuario o ROI do sistema para justificar a assinatura.

### Novo componente `src/components/admin/ValueMetrics.tsx`:

Exibido no Dashboard, calcula e mostra:
- "Pedidos gerenciados este mes: X"
- "Faturamento registrado: R$ X.XXX"
- "Tempo medio de atendimento: X min"
- "Mesas atendidas: X"

### Logica:
- Consulta `pedidos`, `comandas`, `movimentacoes_caixa` do mes atual
- Compara com mes anterior quando disponivel
- Exibe setas de tendencia (subiu/desceu)

---

## Resumo de Todos os Arquivos

### Novos Arquivos (9)
| Arquivo | Descricao |
|---------|-----------|
| `src/pages/LandingRestaurantes.tsx` | Landing page de vendas |
| `src/components/admin/OnboardingChecklist.tsx` | Wizard de primeiros passos |
| `src/components/admin/TrialValueBanner.tsx` | Banner de valor/urgencia no trial |
| `src/components/admin/ValueMetrics.tsx` | Metricas de ROI no dashboard |
| `src/components/admin/ReferralCard.tsx` | Card do programa de indicacao |
| `supabase/functions/trial-email-sequence/index.ts` | Cron de emails do trial |

### Arquivos Modificados (7)
| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Rota `/para-restaurantes` |
| `src/pages/Planos.tsx` | Depoimentos, garantia, FAQ, selo |
| `src/pages/admin/Onboarding.tsx` | Trial 14 dias + dados de exemplo |
| `src/pages/admin/Dashboard.tsx` | Checklist + ValueBanner + ValueMetrics |
| `src/pages/admin/Mesas.tsx` | Contador de uso vs limite |
| `src/pages/admin/Marketing.tsx` | Aba de indicacoes |
| `supabase/functions/send-email/index.ts` | Novos templates |

### Migracoes SQL (3)
| Migracao | Descricao |
|----------|-----------|
| `update_trial_days_14` | Trial de 3 para 14 dias nos planos |
| `create_indicacoes` | Tabela de indicacoes + RLS |
| `add_trial_emails_sent` | Coluna de controle de emails em assinaturas |

---

## Ordem de Implementacao Sugerida

1. **Migracoes SQL** (trial 14 dias + tabela indicacoes)
2. **Landing Page** (`/para-restaurantes`) - porta de entrada
3. **Trial aprimorado** (14 dias + dados de exemplo no onboarding)
4. **Onboarding Checklist** - guiar primeiros passos
5. **Gatilhos de conversao** (TrialValueBanner + contadores de limite)
6. **Pagina de Planos otimizada** (depoimentos, garantia, FAQ)
7. **Programa de Indicacao** (tabela + UI + logica)
8. **Emails automaticos** (sequencia de 6 emails)
9. **Metricas de valor** (dashboard ROI)

