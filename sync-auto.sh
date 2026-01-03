#!/bin/bash

# Script de Sincronização Automática
# Abre o SQL Editor e mostra instruções

echo "======================================================================"
echo "🚀 INICIANDO PROCESSO DE SINCRONIZAÇÃO"
echo "======================================================================"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# URL do SQL Editor
SQL_EDITOR_URL="https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/sql/new"

# Caminho do arquivo SQL
MIGRATION_FILE="supabase/migrations/20260102_complete_sync.sql"

echo -e "${BLUE}📋 ETAPAS:${NC}"
echo ""
echo "1️⃣  Abrindo SQL Editor do Supabase..."
echo "2️⃣  Você copiará o SQL do arquivo de migração"
echo "3️⃣  Colará no editor e executará"
echo "4️⃣  Verificará o resultado"
echo ""

# Abrir browser
echo -e "${YELLOW}🌐 Abrindo browser...${NC}"
if command -v xdg-open > /dev/null; then
  xdg-open "$SQL_EDITOR_URL" 2>/dev/null &
elif command -v open > /dev/null; then
  open "$SQL_EDITOR_URL" 2>/dev/null &
elif command -v "$BROWSER" > /dev/null; then
  "$BROWSER" "$SQL_EDITOR_URL" 2>/dev/null &
else
  echo -e "${RED}❌ Não foi possível abrir o browser automaticamente${NC}"
  echo -e "${YELLOW}📋 Abra manualmente:${NC} $SQL_EDITOR_URL"
fi

sleep 2

echo ""
echo -e "${GREEN}✅ SQL Editor deve estar abrindo no seu browser${NC}"
echo ""
echo "======================================================================"
echo -e "${BLUE}📝 AGORA FAÇA O SEGUINTE:${NC}"
echo "======================================================================"
echo ""
echo "1. No SQL Editor que acabou de abrir:"
echo "   - Cole o SQL que será copiado agora"
echo "   - Clique em 'Run' ou pressione Ctrl+Enter"
echo ""
echo "2. Aguarde a execução (30-60 segundos)"
echo ""
echo "3. Verifique se aparece 'Success'"
echo ""
echo "======================================================================"
echo ""

# Verificar se o arquivo existe
if [ -f "$MIGRATION_FILE" ]; then
  echo -e "${GREEN}✅ Arquivo de migração encontrado${NC}"
  echo ""
  
  # Estatísticas
  LINES=$(wc -l < "$MIGRATION_FILE")
  SIZE=$(du -h "$MIGRATION_FILE" | cut -f1)
  echo -e "${BLUE}📊 Estatísticas:${NC}"
  echo "   - Tamanho: $SIZE"
  echo "   - Linhas: $LINES"
  echo ""
  
  echo "======================================================================"
  echo -e "${YELLOW}📋 COPIANDO SQL PARA O CLIPBOARD...${NC}"
  echo "======================================================================"
  echo ""
  
  # Tentar copiar para clipboard
  if command -v xclip > /dev/null; then
    cat "$MIGRATION_FILE" | xclip -selection clipboard
    echo -e "${GREEN}✅ SQL copiado para o clipboard (xclip)${NC}"
    echo ""
    echo -e "${YELLOW}👉 AÇÃO: Cole no SQL Editor com Ctrl+V e execute!${NC}"
  elif command -v pbcopy > /dev/null; then
    cat "$MIGRATION_FILE" | pbcopy
    echo -e "${GREEN}✅ SQL copiado para o clipboard (pbcopy)${NC}"
    echo ""
    echo -e "${YELLOW}👉 AÇÃO: Cole no SQL Editor com Cmd+V e execute!${NC}"
  else
    echo -e "${YELLOW}⚠️  Clipboard não disponível automaticamente${NC}"
    echo ""
    echo "Copie manualmente executando:"
    echo ""
    echo -e "${BLUE}cat $MIGRATION_FILE | xclip -selection clipboard${NC}"
    echo ""
    echo "Ou abra o arquivo e copie:"
    echo ""
    echo -e "${BLUE}code $MIGRATION_FILE${NC}"
  fi
  
else
  echo -e "${RED}❌ Arquivo de migração não encontrado!${NC}"
  echo ""
  echo "Execute primeiro:"
  echo "  node sync-helper.js"
  exit 1
fi

echo ""
echo "======================================================================"
echo -e "${BLUE}⏳ APÓS EXECUTAR NO SUPABASE:${NC}"
echo "======================================================================"
echo ""
echo "Volte aqui e execute para verificar:"
echo ""
echo -e "${GREEN}node sync-database.js${NC}"
echo ""
echo "Você deve ver:"
echo "  🎉 Todas as tabelas estão sincronizadas!"
echo ""
echo "======================================================================"
echo ""

# Aguardar input do usuário
echo -e "${YELLOW}Pressione ENTER depois de executar no Supabase...${NC}"
read -r

echo ""
echo "🔍 Verificando sincronização..."
echo ""

# Executar verificação
node sync-database.js

echo ""
echo "======================================================================"
echo -e "${GREEN}✨ Processo finalizado!${NC}"
echo "======================================================================"
echo ""
echo "📚 Documentação:"
echo "   - Guia Rápido: SINCRONIZACAO_RAPIDA.md"
echo "   - Guia Completo: GUIA_SINCRONIZACAO.md"
echo "   - Resumo: RESUMO_SINCRONIZACAO.md"
echo ""
