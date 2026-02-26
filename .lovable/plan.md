

# Remover "(WhatsApp)" do recurso Delivery

Substituir "Delivery (WhatsApp)" por apenas "Delivery" em todos os arquivos onde aparece como label de recurso de plano.

## Alterações

| Arquivo | Linha | De | Para |
|---------|-------|----|------|
| `src/pages/Planos.tsx` | 157 | `Delivery (WhatsApp)` | `Delivery` |
| `src/pages/admin/Assinatura.tsx` | 654 | `Delivery: Básico (WhatsApp)` | `Delivery: Básico` |
| `src/components/UpgradeModal.tsx` | 36 | `detalhe: 'WhatsApp'` | remover o detalhe ou deixar sem detalhe |

Nota: Os outros usos de "WhatsApp" (campo de telefone no DeliveryRestaurant e role mapping no useUserRole) não são labels de plano e não serão alterados.

