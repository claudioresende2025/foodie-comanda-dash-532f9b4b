# 🔄 Guia de Sincronização GitHub ↔ Lovable

**Data:** 02/01/2026  
**Problema:** Botão "Update" desabilitado no Lovable

## 📋 Problema Identificado

### Sintomas
- ✅ Código modificado no GitHub
- ❌ Botão "Update" desabilitado no Lovable
- ❌ Alterações não aparecem no Preview/App
- ⚠️ Possível dessincronização entre plataformas

### Causas Comuns
1. **Webhook não configurado/quebrado** - GitHub não notifica Lovable
2. **Build falhando silenciosamente** - Erros não reportados
3. **Cache do Lovable** - Versão antiga em cache
4. **Conflito de branches** - Lovable aponta para branch diferente
5. **Service Worker** - Cache do navegador impedindo atualização

## 🔧 Soluções Implementadas

### 1. Sistema de Notificação Atualizado
**Arquivo:** [`src/components/UpdateNotification.tsx`](src/components/UpdateNotification.tsx)

✅ **Funcionalidades:**
- Verifica atualizações a cada minuto
- Banner de notificação automático
- Botão "Atualizar" funcional
- Limpa cache do Service Worker

### 2. Configuração Supabase
**Arquivo:** [`.env`](.env)

✅ **Validado:**
```bash
VITE_SUPABASE_URL=https://zlwpxflqtyhdwanmupgy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[chave válida]
VITE_SUPABASE_PROJECT_ID=zlwpxflqtyhdwanmupgy
```

### 3. Página Marketing
**Arquivo:** [`src/pages/admin/Marketing.tsx`](src/pages/admin/Marketing.tsx)

✅ **Status:** Código íntegro e funcionando

## 🚀 Como Forçar Sincronização

### Método 1: Script Automático (Recomendado)
```bash
chmod +x force-lovable-update.sh
./force-lovable-update.sh
```

### Método 2: Manual
```bash
# 1. Commit e push
git add .
git commit -m "chore: força sync com Lovable"
git push origin main --force-with-lease

# 2. Criar tag de deploy
git tag -a deploy-$(date +%Y%m%d-%H%M%S) -m "Force deploy"
git push --tags

# 3. Aguardar webhook (2-3 minutos)
```

### Método 3: Via Lovable Dashboard
1. Acesse o dashboard do Lovable
2. Vá em **Settings** > **Integrations**
3. Clique em **Reconnect GitHub**
4. Force um **Manual Rebuild**

## 🔍 Checklist de Diagnóstico

### No GitHub
- [ ] Últimas alterações estão commitadas?
- [ ] Push foi feito para a branch `main`?
- [ ] Não há erros no workflow do GitHub Actions?
- [ ] Webhook está configurado em Settings > Webhooks?

### No Lovable
- [ ] Repositório correto conectado?
- [ ] Branch correta selecionada (`main`)?
- [ ] Último commit aparece no dashboard?
- [ ] Build log mostra sucesso?
- [ ] Botão "Update" está habilitado?

### No Navegador
- [ ] Cache limpo (Ctrl+Shift+Delete)?
- [ ] Service Worker registrado corretamente?
- [ ] Console mostra erros JavaScript?
- [ ] Variáveis de ambiente carregadas?

## 🐛 Troubleshooting

### "Update" continua desabilitado

**Solução 1 - Reconfigurar Webhook:**
```bash
# No Lovable Dashboard
Settings > Integrations > GitHub > Reconnect
```

**Solução 2 - Limpar Cache:**
```bash
# No navegador (Console DevTools)
navigator.serviceWorker.getRegistrations()
  .then(regs => regs.forEach(reg => reg.unregister()))
localStorage.clear()
sessionStorage.clear()
location.reload()
```

**Solução 3 - Verificar Build:**
```bash
npm run build
# Se falhar, corrigir erros e tentar novamente
```

### Erro de Conexão com Supabase

**Validar variáveis:**
```bash
cat .env | grep VITE_SUPABASE
```

**Testar conexão:**
```javascript
// No console do navegador
console.log(import.meta.env.VITE_SUPABASE_URL)
console.log(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
```

### Marketing mostra diferente do Preview

1. **Compare arquivos:**
```bash
git diff HEAD~1 src/pages/admin/Marketing.tsx
```

2. **Force rebuild:**
```bash
./force-lovable-update.sh
```

3. **Limpe cache do navegador:**
- Chrome: Ctrl+Shift+Delete
- Desmarque cache e cookies do site
- Recarregue: Ctrl+F5

## 📊 Monitoramento

### Verificar Sincronização
```bash
# Último commit local
git log -1 --oneline

# Último commit remoto
git fetch && git log origin/main -1 --oneline

# Status de sincronização
git status
```

### Logs do Lovable
1. Dashboard > seu projeto
2. Clique em "View Logs"
3. Verifique:
   - ✅ Build successful
   - ✅ Deploy completed
   - ❌ Erros de build/deploy

## 🎯 Objetivo Final

### Checklist de Sucesso
- [x] Código no GitHub atualizado
- [ ] Lovable sincronizado (webhook funcionando)
- [ ] Botão "Update" habilitado
- [ ] Clicar "Update" aplica mudanças
- [ ] "View App" mostra versão correta
- [ ] Marketing igual ao Preview
- [ ] Supabase conectado sem erros
- [ ] Banner de atualização aparece para novas mudanças

## 📞 Próximos Passos

1. **Execute o script:**
   ```bash
   ./force-lovable-update.sh
   ```

2. **Aguarde 3 minutos**

3. **No Lovable:**
   - Verifique se "Update" está habilitado
   - Clique em "Update"
   - Clique em "View App"

4. **Valide:**
   - Marketing aparece corretamente?
   - Sem erros de Supabase?
   - Banner de atualização funciona?

## 🆘 Suporte

Se após todas as tentativas o problema persistir:

1. **Capture logs:**
```bash
# Build log
npm run build > build.log 2>&1

# Git status
git status > git-status.txt
git log -10 --oneline > git-log.txt
```

2. **No Lovable:**
   - Screenshot do dashboard
   - Screenshot dos logs de build
   - Screenshot da página de Integrations

3. **No navegador:**
   - Console (F12)
   - Network tab (filtro: Supabase)
   - Application > Service Workers

---

**Última atualização:** 02/01/2026  
**Versão:** 1.0
