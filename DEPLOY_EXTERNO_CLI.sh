#!/bin/bash

# ============================================================
# Script de Deploy para o Projeto Supabase Externo
# Projeto: zlwpxflqtyhdwanmupgy
# ============================================================

echo "🚀 Deploy das Edge Functions no Projeto Supabase Externo"
echo "=========================================================="
echo ""

PROJECT_ID="zlwpxflqtyhdwanmupgy"

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "📦 Instalando Supabase CLI..."
    npm install -g supabase
fi

echo ""
echo "🔐 Passo 1: Login no Supabase"
echo "-----------------------------"
echo "Um navegador será aberto. Faça login com a conta que tem acesso ao projeto."
supabase login

echo ""
echo "🔗 Passo 2: Vinculando ao projeto externo ($PROJECT_ID)"
echo "--------------------------------------------------------"
supabase link --project-ref $PROJECT_ID

echo ""
echo "📝 Passo 3: Removendo deno.lock para evitar conflitos"
echo "------------------------------------------------------"
if [ -f "supabase/functions/deno.lock" ]; then
    mv supabase/functions/deno.lock supabase/functions/deno.lock.bak
    echo "✅ deno.lock renomeado para deno.lock.bak"
else
    echo "ℹ️  deno.lock não encontrado (ok)"
fi

echo ""
echo "🔑 Passo 4: Configurando segredos"
echo "----------------------------------"
echo "Verificando segredos existentes..."
supabase secrets list

echo ""
echo "⚠️  IMPORTANTE: Certifique-se de que os seguintes segredos estão configurados:"
echo "   - RESEND_API_KEY (obter em https://resend.com/api-keys)"
echo "   - STRIPE_SECRET_KEY"
echo "   - STRIPE_WEBHOOK_SECRET"
echo ""
read -p "Os segredos já estão configurados? (s/n): " secrets_ok

if [ "$secrets_ok" != "s" ]; then
    echo ""
    echo "Para configurar os segredos, execute:"
    echo "  supabase secrets set RESEND_API_KEY=\"re_XXXXX...\""
    echo "  supabase secrets set STRIPE_SECRET_KEY=\"sk_live_XXXXX...\""
    echo "  supabase secrets set STRIPE_WEBHOOK_SECRET=\"whsec_XXXXX...\""
    echo ""
    read -p "Pressione ENTER após configurar os segredos..."
fi

echo ""
echo "📤 Passo 5: Deploy das Edge Functions"
echo "--------------------------------------"

# Lista de funções a serem deployadas
FUNCTIONS=(
    "send-email"
    "stripe-subscription-webhook"
    "create-subscription-checkout"
    "verify-subscription-payment"
    "process-subscription"
    "request-refund"
    "create-delivery-checkout"
    "verify-delivery-payment"
    "complete-delivery-order"
    "delete-user"
)

echo "Funções a serem deployadas:"
for func in "${FUNCTIONS[@]}"; do
    echo "  - $func"
done
echo ""

for func in "${FUNCTIONS[@]}"; do
    echo "📦 Deployando: $func"
    supabase functions deploy $func --no-verify-jwt
    if [ $? -eq 0 ]; then
        echo "✅ $func deployada com sucesso"
    else
        echo "❌ Erro ao deployar $func"
    fi
    echo ""
done

echo ""
echo "📋 Passo 6: Verificando deploy"
echo "-------------------------------"
supabase functions list

echo ""
echo "============================================================"
echo "✅ DEPLOY CONCLUÍDO!"
echo "============================================================"
echo ""
echo "Próximos passos:"
echo "1. Verifique os logs: supabase functions logs stripe-subscription-webhook --limit 20"
echo "2. Teste o envio de e-mail com um checkout de teste"
echo "3. Monitore o webhook do Stripe para confirmar que os eventos estão sendo processados"
echo ""
echo "URLs das funções no projeto externo:"
echo "  https://$PROJECT_ID.supabase.co/functions/v1/send-email"
echo "  https://$PROJECT_ID.supabase.co/functions/v1/stripe-subscription-webhook"
echo ""
