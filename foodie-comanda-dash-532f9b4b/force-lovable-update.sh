#!/bin/bash
# Script para forçar sincronização com Lovable
# Data: 02/01/2026

set -e

echo "🔄 Iniciando sincronização forçada com Lovable..."
echo ""

# 1. Verificar estado do Git
echo "📊 Verificando estado do repositório..."
git status

# 2. Adicionar todas as alterações
echo ""
echo "➕ Adicionando alterações..."
git add .

# 3. Verificar se há algo para commitar
if git diff-index --quiet HEAD --; then
    echo "✅ Nenhuma alteração para commitar"
else
    echo "💾 Commitando alterações..."
    git commit -m "chore: força sincronização com Lovable - $(date +'%Y-%m-%d %H:%M:%S')" || true
fi

# 4. Push forçado para garantir sincronização
echo ""
echo "🚀 Enviando para GitHub..."
git push origin main --force-with-lease

# 5. Criar tag de deploy para forçar rebuild
echo ""
echo "🏷️  Criando tag de deploy..."
TAG_NAME="deploy-$(date +'%Y%m%d-%H%M%S')"
git tag -a "$TAG_NAME" -m "Force deploy: Lovable sync"
git push origin "$TAG_NAME"

echo ""
echo "✅ Sincronização concluída!"
echo ""
echo "📝 Próximos passos no Lovable:"
echo "   1. Aguarde 2-3 minutos para o webhook processar"
echo "   2. Vá até o dashboard do Lovable"
echo "   3. O botão 'Update' deve estar habilitado agora"
echo "   4. Clique em 'Update' para aplicar as mudanças"
echo "   5. Clique em 'View App' para ver no navegador"
echo ""
echo "🔍 Se o botão ainda estiver desabilitado:"
echo "   • Verifique o webhook em Settings > Integrations"
echo "   • Force um rebuild manual no Lovable"
echo "   • Verifique se há erros no build log"
