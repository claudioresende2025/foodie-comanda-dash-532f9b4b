
# Correcao do Loop Infinito de Pagamento

## Problema Identificado

Apos o pagamento no Stripe, o sistema entra em loop porque a assinatura nunca e salva no banco de dados. O fluxo quebrado e:

1. Usuario sem assinatura -> `SubscriptionGuard` bloqueia acesso -> mostra modal de planos
2. Usuario paga no Stripe -> Stripe redireciona para `/admin/assinatura?subscription=success&planoId=...`
3. `SubscriptionHandler` (em App.tsx) detecta `?subscription=success` -> **desloga o usuario** e manda para `/auth`
4. Usuario loga de novo -> continua sem assinatura no banco -> volta ao passo 1

O problema central: ninguem chama a funcao `process-subscription` para gravar a assinatura no banco. A URL de sucesso aponta para uma rota protegida que bloqueia antes de processar.

## Solucao

### 1. Corrigir a URL de sucesso no UpgradeModal (src/components/UpgradeModal.tsx)

Trocar o `successUrl` de `/admin/assinatura?subscription=success&planoId=...` para `/subscription/success?session_id={CHECKOUT_SESSION_ID}&planoId=...&periodo=mensal`.

A pagina `/subscription/success` ja existe, nao e protegida pelo SubscriptionGuard, e ja tem toda a logica para chamar `process-subscription` e salvar a assinatura no banco.

### 2. Corrigir o SubscriptionHandler (src/App.tsx)

O `SubscriptionHandler` atual intercepta `?subscription=success` em qualquer rota (exceto `/subscription`) e desloga o usuario. Isso interfere com o fluxo. Ajustar para nao deslogar quando o usuario ja tem empresa (caso de upgrade), apenas processar a assinatura e continuar.

### 3. Corrigir a Edge Function create-subscription-checkout

A URL de sucesso precisa incluir `{CHECKOUT_SESSION_ID}` como placeholder do Stripe para que a pagina Success receba o ID da sessao e possa verificar o pagamento.

### 4. Garantir que a pagina Assinatura processe o retorno

Ajustar `src/pages/admin/Assinatura.tsx` para que, ao detectar `?subscription=success` na URL, chame `process-subscription` com os parametros corretos antes de qualquer outra logica.

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/UpgradeModal.tsx` | Mudar `successUrl` para `/subscription/success?session_id={CHECKOUT_SESSION_ID}&planoId=...&periodo=mensal` |
| `src/App.tsx` | Ajustar `SubscriptionHandler` para nao deslogar usuarios com empresa existente; em vez disso, chamar `process-subscription` diretamente |
| `supabase/functions/create-subscription-checkout/index.ts` | Garantir que o `success_url` use o placeholder `{CHECKOUT_SESSION_ID}` do Stripe |

## Resultado Esperado

Apos o pagamento no Stripe:
1. Usuario retorna para `/subscription/success` (rota publica)
2. A pagina detecta que o usuario ja tem conta e empresa
3. Chama `process-subscription` para salvar a assinatura no banco
4. Redireciona para `/admin` (dashboard) com assinatura ativa
5. `SubscriptionGuard` libera acesso normalmente
