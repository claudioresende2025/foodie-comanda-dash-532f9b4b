

# Forçar reinstalação de dependências

## O que será feito

Um bump mínimo seguro em uma dependência do `package.json` para disparar a reinstalação automática de todos os pacotes no ambiente Lovable. Isso resolverá possíveis problemas de módulos não encontrados (como o `tesseract.js`).

## Alteração

### `package.json`
- Bump `@types/node` de `^22.16.5` para `^22.16.6` (devDependency de tipos, zero impacto no app)

Isso dispara a reinstalação completa de todas as dependências sem afetar nenhuma funcionalidade da aplicação.

**Total: 1 arquivo, 1 linha alterada.**

