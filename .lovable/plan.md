

# Plano: Restaurar Upload da Galeria + Melhorar Precisão do Scanner

## Problema

O input de arquivo existe no código (linha 472-478), mas em dispositivos móveis os MIME types específicos (`image/jpeg,image/png,image/webp,image/heic`) podem fazer o Android abrir a câmera por padrão ao invés de mostrar a opção de galeria.

## Alterações

### 1. `src/components/admin/MenuScannerModal.tsx`

- **Trocar `accept`** de `"image/jpeg,image/png,image/webp,image/heic"` para `"image/*"` — isso garante que o Android/iOS mostre o seletor com opções "Câmera" e "Galeria" ao invés de ir direto para câmera
- **Adicionar compressão de imagem** antes de enviar para a edge function — imagens da galeria podem ser muito grandes (4000x3000px+), causando timeout. Redimensionar para max 2048px e comprimir a 85% JPEG
- **Manter o fluxo atual** do `handleFileUpload` que já funciona corretamente (leitura base64, validação de tipo e tamanho)

### 2. `supabase/functions/scan-menu/index.ts`

- **Reforçar o prompt** com regras mais explícitas:
  - Copiar nomes **caractere por caractere** como aparecem no cardápio
  - Cada item tem preço **individual** — se não conseguir ler, usar `0`
  - Nunca repetir o preço de um item para outro
- **Adicionar validação pós-resposta**: se mais de 70% dos produtos têm o mesmo preço, marcar como suspeito e tentar reprocessar
- **Aumentar `max_tokens`** para 16384 para cardápios grandes

**Total: 2 arquivos alterados**

