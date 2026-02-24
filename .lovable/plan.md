

# Correção: Chave PIX não carregada na página Menu

## Problema

A query que busca os dados da empresa na página Menu (`fetchMenuData`) seleciona apenas `id, nome_fantasia, logo_url` — o campo `chave_pix` não está incluído. Por isso, `empresa?.chave_pix` é sempre `undefined`, e o componente PixQRCode exibe "Chave PIX não configurada".

## Solução

Adicionar `chave_pix` e `endereco_completo` à query do Supabase na linha 381 de `src/pages/Menu.tsx`.

### Alteração

| Arquivo | O que muda |
|---------|-----------|
| `src/pages/Menu.tsx` linha 381 | Adicionar `chave_pix, endereco_completo` ao `.select()` |

**Antes:**
```typescript
.select("id, nome_fantasia, logo_url")
```

**Depois:**
```typescript
.select("id, nome_fantasia, logo_url, chave_pix, endereco_completo")
```

Nenhuma outra alteração é necessária — o tipo `Empresa` já declara `chave_pix` e `endereco_completo` como campos opcionais, e o componente `PixQRCode` já recebe `empresa?.chave_pix`. O problema é exclusivamente a query que não busca o campo.

