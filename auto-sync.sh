#!/bin/bash

# Auto-sync melhorado: usa inotifywait quando disponível para minimizar latência
# Fallback para polling com intervalo configurável (AUTOSYNC_INTERVAL em segundos)

set -u

REPO_DIR="/workspaces/foodie-comanda-dash-532f9b4b"
cd "$REPO_DIR" || exit 1

echo "🔄 Iniciando auto-sync (pasta: $REPO_DIR)"

# Configurações
GIT_NAME=${AUTOSYNC_GIT_NAME:-"Auto Sync Bot"}
GIT_EMAIL=${AUTOSYNC_GIT_EMAIL:-"auto-sync@localhost"}
INTERVAL=${AUTOSYNC_INTERVAL:-5}
INOTIFYWAIT=$(command -v inotifywait || true)

# Config git local para evitar erros automáticos
git config user.name "$GIT_NAME" >/dev/null 2>&1 || true
git config user.email "$GIT_EMAIL" >/dev/null 2>&1 || true
git config commit.gpgSign false >/dev/null 2>&1 || true

trap "echo; echo '🛑 Auto-sync interrompido'; exit 0" SIGINT SIGTERM

run_sync() {
    # Debounce curto para agrupar mudanças rápidas
    sleep 1

    if [[ -n $(git status --porcelain) ]]; then
        echo "📝 Mudanças detectadas em $(date '+%Y-%m-%d %H:%M:%S')"
        git add -A
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
        if git commit -m "Auto-sync: $TIMESTAMP" --no-verify --quiet 2>/dev/null; then
            echo "✔️  Commit criado: $TIMESTAMP"
        else
            echo "ℹ️  Nenhum commit criado (possivelmente sem mudanças staged)"
        fi

        BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
        echo "⬆️  Tentando push para origin/$BRANCH..."
        if git push origin "$BRANCH" --quiet 2>&1; then
            echo "✅ Sincronizado com sucesso (branch: $BRANCH)!"
        else
            echo "❌ Push falhou, tentando pull --rebase e re-push..."
            git fetch origin --quiet
            if git rev-parse --verify origin/$BRANCH >/dev/null 2>&1; then
                if git pull --rebase origin "$BRANCH" --quiet; then
                    git push origin "$BRANCH" --quiet && echo "✅ Sincronizado após rebase!" || echo "⚠️ Push ainda falhou após rebase"
                else
                    echo "⚠️ Falha no rebase; abortando rebase";
                    git rebase --abort >/dev/null 2>&1 || true
                fi
            else
                echo "⚠️ Branch remoto origin/$BRANCH não existe; criando branch remoto"
                git push -u origin "$BRANCH" --quiet && echo "✅ Branch criado e sincronizado"
            fi
        fi
        echo ""
    fi
}

if [[ -n "$INOTIFYWAIT" ]]; then
    echo "⚡ inotifywait encontrado — usando modo reativo (debounce ${INTERVAL}s)."
    # monitorar mudanças excluindo .git e node_modules
    while true; do
        # aguarda evento (criação, modificação, remoção, renomeio)
        $INOTIFYWAIT -r -e modify,create,delete,move --exclude '(^|/)\.git/|node_modules' . >/dev/null 2>&1 || true
        run_sync
        # evitar excesso de triggers: aguardar INTERVAL segundos antes de reentrar
        sleep "$INTERVAL"
    done
else
    echo "⏱ inotifywait não encontrado — usando polling a cada ${INTERVAL}s (defina AUTOSYNC_INTERVAL para ajustar)."
    while true; do
        run_sync
        sleep "$INTERVAL"
    done
fi
