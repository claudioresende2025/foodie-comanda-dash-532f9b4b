#!/bin/bash

# Script de Force Deploy - Foodie Comanda Dash
# Este script força uma nova build e deploy, limpando todos os caches

echo "🚀 Iniciando Force Deploy..."
echo ""

# 1. Limpar cache do Vite e node_modules
echo "📦 Limpando caches de build..."
rm -rf node_modules/.vite
rm -rf dist
rm -rf .parcel-cache
rm -rf .cache
echo "✅ Cache limpo"
echo ""

# 2. Reinstalar dependências (opcional, descomente se necessário)
# echo "📥 Reinstalando dependências..."
# npm ci
# echo "✅ Dependências reinstaladas"
# echo ""

# 3. Executar build de produção
echo "🔨 Executando build de produção..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build concluída com sucesso!"
else
    echo "❌ Erro no build!"
    exit 1
fi
echo ""

# 4. Verificar se há alterações para commit
echo "🔍 Verificando alterações..."
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Alterações detectadas. Criando commit..."
    git add .
    git commit -m "chore: Force deploy - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "✅ Commit criado"
else
    echo "ℹ️  Nenhuma alteração detectada"
fi
echo ""

# 5. Push para forçar deploy
echo "📤 Enviando para repositório..."
git push origin main
echo "✅ Push concluído!"
echo ""

echo "✨ Force Deploy finalizado!"
echo "📌 Aguarde alguns minutos para o Lovable/Vercel processar o deploy"
echo ""
echo "💡 Dicas:"
echo "   - Abra o navegador em modo anônimo para testar"
echo "   - Limpe o cache do navegador (Ctrl+Shift+Del)"
echo "   - Verifique o painel do Lovable para erros de build"
