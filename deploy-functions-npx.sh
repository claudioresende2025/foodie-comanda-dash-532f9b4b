#!/bin/bash

echo "🚀 Deploy das Edge Functions via NPX"
echo "====================================="
echo ""
echo "Este script fará o deploy das 3 funções corrigidas."
echo "Você precisará fazer login no Supabase quando solicitado."
echo ""

read -p "Pressione ENTER para continuar ou Ctrl+C para cancelar..."

echo ""
echo "📝 Passo 1: Login no Supabase"
echo "-----------------------------"
echo "Um navegador será aberto. Faça login e autorize."
npx supabase@latest login

echo ""
echo "📝 Passo 2: Linkando ao projeto"
echo "--------------------------------"
npx supabase@latest link --project-ref zlwpxflqtyhdwanmupgy

echo ""
echo "📝 Passo 3: Deploy da função create-delivery-checkout"
echo "------------------------------------------------------"
npx supabase@latest functions deploy create-delivery-checkout

echo ""
echo "📝 Passo 4: Deploy da função verify-delivery-payment"
echo "-----------------------------------------------------"
npx supabase@latest functions deploy verify-delivery-payment

echo ""
echo "📝 Passo 5: Deploy da função complete-delivery-order"
echo "-----------------------------------------------------"
npx supabase@latest functions deploy complete-delivery-order

echo ""
echo "✅ DEPLOY CONCLUÍDO!"
echo "===================="
echo ""
echo "Agora teste o pagamento com cartão novamente."
echo "O erro 'Dados obrigatórios ausentes' deve estar resolvido!"
echo ""
