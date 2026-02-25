

# Renomear "Foodie Comanda" para "Food Comanda" em todo o projeto

## Escopo

Substituir todas as ocorrências de "Foodie Comanda" (e variações como "Foodie Comanda Pro") por "Food Comanda" / "Food Comanda Pro" nos seguintes arquivos:

| Arquivo | Ocorrências | Alteração |
|---------|-------------|-----------|
| `src/pages/Planos.tsx` | 3 | "Foodie Comanda Pro" → "Food Comanda Pro", "Foodie Comanda" → "Food Comanda" |
| `src/pages/LandingRestaurantes.tsx` | 3 | "Foodie Comanda" → "Food Comanda" |
| `supabase/functions/send-email/index.ts` | ~10 | "Foodie Comanda Pro" → "Food Comanda Pro" em todos os templates de email |
| `supabase/functions/trial-email-sequence/index.ts` | Verificar | Mesma substituição |

Nota: os emails de contato (`suporte@foodiecomanda.com.br`, `suporte@foodiecomanda.com`) serão mantidos inalterados, pois são endereços reais e não o nome da marca.

## Correção do build error existente

Também será corrigido o erro de build em `src/pages/admin/PedidosDelivery.tsx` onde `troco_para` não existe no tipo `PedidoDelivery`.

