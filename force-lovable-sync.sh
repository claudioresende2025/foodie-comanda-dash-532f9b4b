#!/bin/bash

# 🚀 Script de Force Deploy para Lovable
# Força a sincronização GitHub → Lovable quando o botão Update está desabilitado

set -e

echo "🔄 Iniciando Force Deploy para Lovable..."
echo ""

# 1. Verificar se há alterações não commitadas
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Há alterações não commitadas. Commitando automaticamente..."
    git add .
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    git commit -m "chore: Force deploy - $TIMESTAMP"
    echo "✅ Commit criado"
else
    echo "ℹ️  Não há alterações para commitar. Criando commit vazio para forçar build..."
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    git commit --allow-empty -m "chore: Force Lovable rebuild - $TIMESTAMP"
    echo "✅ Commit vazio criado para forçar rebuild"
fi

echo ""

# 2. Push para GitHub
echo "📤 Enviando para GitHub..."
git push origin main
echo "✅ Push concluído"

echo ""

# 3. Testar build local
echo "🔨 Testando build local..."
npm run build
echo "✅ Build local bem-sucedido"

echo ""
echo "========================================="
echo "✅ FORCE DEPLOY CONCLUÍDO!"
echo "========================================="
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Aguarde 1-3 minutos para o Lovable executar o build"
echo "2. Abra o Lovable e verifique se o botão 'Update' está habilitado"
echo "3. Se ainda estiver desabilitado:"
echo "   - Clique em 'Rebuild' no Lovable"
echo "   - Ou execute este script novamente: ./force-lovable-sync.sh"
echo ""
echo "4. No Preview, pressione Ctrl+Shift+R para limpar cache"
echo "5. Verifique se o banner de atualização aparece"
echo ""
echo "🔍 Verificar logs do build no Lovable:"
echo "   https://lovable.dev/projects/[seu-projeto]/builds"
echo ""
echo "========================================="
