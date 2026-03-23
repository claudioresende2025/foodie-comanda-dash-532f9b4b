
## Objetivo

Corrigir o fluxo para que **“Enviar Imagem” abra a galeria/arquivos de fotos**, sem acionar a câmera no Android/mobile.

## Diagnóstico provável

Embora o `capture` já tenha sido removido, o input ainda usa `accept="image/*"`. Em alguns navegadores mobile/PWAs isso ainda pode priorizar ou sugerir a câmera. Além disso, há **dois inputs de imagem** no modal:
- upload principal do cardápio
- upload da foto de cada produto na revisão

Hoje ambos usam `accept="image/*"`.

## Implementação proposta

### 1. Ajustar os inputs de galeria no `MenuScannerModal`
Arquivo: `src/components/admin/MenuScannerModal.tsx`

Trocar os inputs usados para **galeria** de:
- `accept="image/*"`

para algo mais explícito, por exemplo:
- `accept="image/png,image/jpeg,image/jpg,image/webp"`

Aplicar nos dois pontos:
- input do botão **“Enviar Imagem”**
- input do botão **“Galeria”** de cada produto

Isso reduz o comportamento de o navegador abrir a câmera por padrão e força melhor o seletor de arquivos/fotos.

### 2. Manter câmera separada
Preservar o fluxo atual de câmera apenas nos botões:
- **Usar Câmera**
- **Tirar Foto**

Ou seja:
- galeria = `input type="file"`
- câmera = `getUserMedia()` / captura própria já existente

### 3. Validar o texto da UI
Se necessário, reforçar na interface que:
- “Enviar Imagem” = galeria/arquivos
- “Usar Câmera” = foto ao vivo

Isso evita ambiguidade para o usuário.

## Resultado esperado

Após a correção:
- tocar em **Enviar Imagem** deve abrir o seletor de fotos/arquivos
- tocar em **Galeria** na revisão deve abrir o mesmo seletor
- a câmera só deve abrir nos botões específicos de câmera

## Detalhe técnico

No Android/Chrome, `accept="image/*"` pode continuar abrindo fluxos ligados à câmera mesmo sem `capture`. Usar uma lista explícita de MIME types costuma ser mais confiável quando a intenção é abrir a galeria.
