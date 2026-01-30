# Status das Correções - Food Comanda

## Resumo Final

| # | Correção | Status |
|---|----------|--------|
| 1 | Impressão formato cupom não fiscal | ✅ CONCLUÍDO |
| 2 | Cancelar comanda → mesa disponível | ✅ CONCLUÍDO |
| 3 | Persistência de rota ao atualizar | ✅ CONCLUÍDO |
| 4 | Erro cadastro Motoboy | ✅ RESOLVIDO (já existia) |
| 5 | Erro exclusão membro (email existe) | ✅ CONCLUÍDO |
| 6 | Couver/Música ao vivo (pt-BR) | ✅ CONCLUÍDO |
| 7 | Opção "Esqueci minha senha" | ✅ CONCLUÍDO |
| 8 | Mensagem de permissão para staff | ✅ CONCLUÍDO |
| 9 | Menu lateral filtrado por perfil | ✅ CONCLUÍDO |
| 10 | Configurações para todos os perfis | ✅ CONCLUÍDO |
| 11 | Mostrar perfil no menu lateral | ✅ CONCLUÍDO |
| 12 | Expandir popup novo produto | ✅ CONCLUÍDO |

## Detalhamento das Implementações

### 1. Impressão Cupom Não Fiscal
- Criada nova função `printCaixaReceipt()` em `kitchenPrinter.ts`
- Formato 80mm com: dados do restaurante, CNPJ, itens com preços, taxa de serviço, couver, total
- Atualizado `Caixa.tsx` para usar nova função

### 2. Cancelar Comanda
- Adicionado `cancelComandaMutation` em `Caixa.tsx`
- Botão "Cancelar" ao lado de "Imprimir"
- Libera mesa e mesas juntas automaticamente

### 3. Persistência de Rota
- Removido toast de erro em `AdminLayout.tsx` que aparecia em page reload

### 5. Exclusão de Membro
- Corrigida URL da Edge Function em `Equipe.tsx` para usar URL completa com token

### 6. Couver PT-BR
- Dias da semana traduzidos para português (Seg, Ter, Qua...)
- Formato de datas DD/MM/AAAA em `Empresa.tsx`

### 7. Esqueci Minha Senha
- Adicionado modal e funcionalidade em `Auth.tsx`
- Usa `supabase.auth.resetPasswordForEmail()`

### 8-9. RBAC e Menu Lateral
- Staff vê apenas opções permitidas (sem cadeados)
- Staff recebe toast ao tentar acessar página sem permissão
- Proprietário/Gerente vê modal de upgrade para recursos do plano

### 10. Configurações Acessível
- `canAccessConfiguracoes` agora retorna `true` para todos em `useUserRole.ts`

### 11. Perfil no Menu Lateral
- Badge com nome do perfil abaixo do email em `AdminSidebar.tsx`

### 12. Popup Produto Expandido
- `DialogContent` alterado para `max-w-2xl` em `Cardapio.tsx`
- Removido scroll interno
