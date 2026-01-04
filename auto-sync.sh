#!/bin/bash

# Script de sincronização automática com GitHub
# Monitora mudanças e faz commit/push automaticamente

cd /workspaces/foodie-comanda-dash-532f9b4b

echo "🔄 Iniciando sincronização automática com GitHub..."
echo "📁 Monitorando: /workspaces/foodie-comanda-dash-532f9b4b"
echo "⏰ Verificando mudanças a cada 30 segundos"
echo "🛑 Pressione Ctrl+C para parar"
echo ""

while true; do
    # Verificar se há mudanças
    if [[ -n $(git status --porcelain) ]]; then
        echo "📝 Mudanças detectadas em $(date '+%H:%M:%S')"
        
        # Adicionar todas as mudanças
        git add -A
        
        # Criar commit com timestamp
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
        git commit -m "Auto-sync: $TIMESTAMP" --quiet
        
        # Push para o GitHub
        echo "⬆️  Sincronizando com GitHub..."
        if git push origin main --quiet 2>&1; then
            echo "✅ Sincronizado com sucesso!"
        else
            echo "❌ Erro ao sincronizar. Tentando pull primeiro..."
            git pull --rebase origin main --quiet
            git push origin main --quiet
            echo "✅ Sincronizado após pull!"
        fi
        echo ""
    fi
    
    # Aguardar 30 segundos antes da próxima verificação
    sleep 30
done
