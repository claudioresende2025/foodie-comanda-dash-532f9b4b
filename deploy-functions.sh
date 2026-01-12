#!/bin/bash

# Script para fazer deploy das Edge Functions corrigidas

echo "🚀 Deploy das Edge Functions Corrigidas"
echo "========================================"
echo ""

PROJECT_ID="zlwpxflqtyhdwanmupgy"

# Verificar se npx está disponível
if ! command -v npx &> /dev/null; then
    echo "❌ npx não encontrado. Instale o Node.js primeiro."
    exit 1
fi

echo "📦 Instalando Supabase CLI..."
npm install -g supabase

echo ""
echo "🔐 Fazendo login no Supabase..."
echo "   Cole seu Access Token quando solicitado"
echo "   (Obtenha em: https://supabase.com/dashboard/account/tokens)"
supabase login

echo ""
echo "🔗 Linkando ao projeto..."
supabase link --project-ref $PROJECT_ID

echo ""
echo "📤 Fazendo deploy das funções..."
supabase functions deploy create-delivery-checkout
supabase functions deploy verify-delivery-payment  
supabase functions deploy complete-delivery-order
supabase functions deploy create-subscription-checkout
supabase functions deploy stripe-subscription-webhook

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "⚠️  IMPORTANTE: Configure os Secrets no painel do Supabase:"
echo "   1. Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/settings/functions"
echo "   2. Adicione o secret: STRIPE_SECRET_KEY"
echo "   3. Valor: sua chave do Stripe (sk_test_...)"
echo ""
