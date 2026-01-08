#!/bin/bash

# Script de sincronização automática com GitHub
# Monitora mudanças e faz commit/push automaticamente

cd /workspaces/foodie-comanda-dash-532f9b4b

echo "🔄 Iniciando sincronização automática com GitHub..."
echo "📁 Monitorando: /workspaces/foodie-comanda-dash-532f9b4b"
echo "⏰ Verificando mudanças a cada 30 segundos"
echo "🛑 Pressione Ctrl+C para parar"
echo ""

# Configurações locais para evitar erros de commit/push automatizados
# Use variáveis de ambiente se fornecidas, senão use valores seguros
GIT_NAME=${AUTOSYNC_GIT_NAME:-"Auto Sync Bot"}
GIT_EMAIL=${AUTOSYNC_GIT_EMAIL:-"auto-sync@localhost"}

# Apply local git config to avoid GPG/signing/author errors
git config user.name "$GIT_NAME" >/dev/null 2>&1 || true
git config user.email "$GIT_EMAIL" >/dev/null 2>&1 || true
git config commit.gpgSign false >/dev/null 2>&1 || true

# Handle Ctrl+C gracefully
trap "echo; echo '🛑 Auto-sync interrompido pelo usuário'; exit 0" SIGINT SIGTERM

while true; do
        # Verificar se há mudanças
        if [[ -n $(git status --porcelain) ]]; then
                echo "📝 Mudanças detectadas em $(date '+%Y-%m-%d %H:%M:%S')"

                # Adicionar todas as mudanças
                git add -A

                # Criar commit com timestamp (ignora se não houver alterações a commitar)
                TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
                if git commit -m "Auto-sync: $TIMESTAMP" --no-verify --quiet 2>/dev/null; then
                    echo "✔️  Commit criado: $TIMESTAMP"
                else
                    echo "ℹ️  Nada para commitar (commit falhou ou não houve alterações)"
                fi

                # Detectar branch atual (fallback para main)
                BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

                # Push para o GitHub com tratamento de conflitos
                echo "⬆️  Tentando push para origin/$BRANCH..."
                if git push origin "$BRANCH" --quiet 2>&1; then
                        echo "✅ Sincronizado com sucesso (branch: $BRANCH)!"
                else
                        echo "❌ Push falhou, tentando atualizar e re-push..."
                        git fetch origin --quiet
                        if git rev-parse --verify origin/$BRANCH >/dev/null 2>&1; then
                            echo "🔁 Rebase com origin/$BRANCH"
                            if git pull --rebase origin "$BRANCH" --quiet; then
                                git push origin "$BRANCH" --quiet && echo "✅ Sincronizado após rebase!" || echo "⚠️ Push ainda falhou após rebase"
                            else
                                echo "⚠️ Falha no rebase; criando backup local e abortando push attempt"
                                git rebase --abort >/dev/null 2>&1 || true
                            fi
                        else
                            echo "⚠️ Branch remoto origin/$BRANCH não existe; criando branch remoto"
                            git push -u origin "$BRANCH" --quiet && echo "✅ Branch criado e sincronizado"
                        fi
                fi
                echo ""
        fi
    
    # Aguardar 30 segundos antes da próxima verificação
    sleep 30
done
