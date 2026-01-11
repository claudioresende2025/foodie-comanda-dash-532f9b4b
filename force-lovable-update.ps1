# Script PowerShell para forçar sincronização com Lovable
# Data: 11/01/2026

Write-Host "🔄 Iniciando sincronização forçada com Lovable..."

# 1. Verificar estado do Git
Write-Host "📊 Verificando estado do repositório..."
git status

# 2. Adicionar todas as alterações
Write-Host "➕ Adicionando alterações..."
git add .

# 3. Verificar se há algo para commitar
$hasChanges = git status --porcelain
if ($hasChanges) {
    Write-Host "💾 Commitando alterações..."
    $date = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    git commit -m "chore: força sincronização com Lovable - $date"
} else {
    Write-Host "✅ Nenhuma alteração para commitar"
}

# 4. Push forçado para garantir sincronização
Write-Host "🚀 Enviando para GitHub..."
git push origin main --force

# 5. Criar tag de deploy para forçar rebuild
Write-Host "🏷️  Criando tag de deploy..."
$tag = "deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
git tag -a $tag -m "Force deploy: Lovable sync"
git push origin $tag

Write-Host "✅ Sincronização concluída!"
Write-Host "📝 Próximos passos no Lovable:"
Write-Host "   1. Aguarde 2-3 minutos para o webhook processar"
Write-Host "   2. Vá até o dashboard do Lovable"
Write-Host "   3. O botão 'Update' deve estar habilitado agora"
Write-Host "   4. Clique em 'Update' para aplicar as mudanças"
Write-Host "   5. Clique em 'View App' para ver no navegador"
Write-Host ""
Write-Host "🔍 Se o botão ainda estiver desabilitado:"
Write-Host "   • Verifique o webhook em Settings > Integrations"
Write-Host "   • Force um rebuild manual no Lovable"
Write-Host "   • Verifique se há erros no build log"
