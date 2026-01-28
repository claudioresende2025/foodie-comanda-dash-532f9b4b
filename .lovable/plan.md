
# Plano de Correção: Página admin/Empresa

## Diagnóstico Detalhado

### Problema 1: Chave PIX Não Salva
**Causa**: O estado `formData` é inicializado com campos vazios e **não existe um `useEffect`** que popule esses dados quando a query da empresa retorna os dados do banco.

```typescript
// Linha 37-43 - Estado sempre vazio inicialmente
const [formData, setFormData] = useState<any>({
  nome_fantasia: '',
  cnpj: '',
  inscricao_estadual: '',
  endereco_completo: '',
  chave_pix: '',  // ❌ SEMPRE vazio!
});
```

Quando a empresa é carregada pela query, os dados não são transferidos para o `formData`, então o campo `chave_pix` fica vazio no formulário.

### Problema 2: Nome Fantasia e CNPJ Não São Preenchidos
**Causa**: Mesmo problema - falta o `useEffect` para sincronizar.

```typescript
// Linha 282 - tem fallback, mas não ideal
value={formData.nome_fantasia || empresa?.nome_fantasia || ''}

// Linha 291 - SEM fallback! Nunca mostra o CNPJ existente
value={formData.cnpj}  // ❌ Não tem || empresa?.cnpj
```

O CNPJ no banco está armazenado sem máscara (ex: `83888388000188`), mas o campo precisa aplicar a máscara para exibição.

---

## Solução Completa

### Fase 1: Adicionar `useEffect` para Popular o Formulário

Adicionar um `useEffect` que observa quando os dados da `empresa` são carregados e preenche o `formData` automaticamente:

```typescript
// NOVO useEffect - após linha 57
useEffect(() => {
  if (empresa) {
    setFormData({
      nome_fantasia: empresa.nome_fantasia || '',
      cnpj: empresa.cnpj ? maskCNPJ(empresa.cnpj) : '',  // Aplica máscara ao exibir
      inscricao_estadual: empresa.inscricao_estadual || '',
      endereco_completo: empresa.endereco_completo || '',
      chave_pix: empresa.chave_pix || '',
    });
  }
}, [empresa]);
```

### Fase 2: Corrigir os Campos do Formulário

Remover fallbacks inconsistentes nos inputs para usar apenas `formData`:

```typescript
// Nome Fantasia - usar apenas formData (já preenchido pelo useEffect)
value={formData.nome_fantasia}

// CNPJ - usar apenas formData (já preenchido com máscara pelo useEffect)
value={formData.cnpj}

// Inscrição Estadual - usar apenas formData
value={formData.inscricao_estadual}

// Endereço - usar apenas formData
value={formData.endereco_completo}

// Chave PIX - usar apenas formData
value={formData.chave_pix}
```

### Fase 3: Adicionar Log de Debug no Mutation

Para garantir que a chave PIX está sendo salva corretamente:

```typescript
// Na mutationFn, adicionar log antes do update
console.log('Salvando dados da empresa:', {
  nome_fantasia: formData.nome_fantasia,
  cnpj: cnpjClean,
  chave_pix: formData.chave_pix,
  // ... outros campos
});
```

---

## Resumo de Alterações

| # | Alteração | Descrição |
|---|-----------|-----------|
| 1 | Adicionar `useEffect` | Popular `formData` quando `empresa` é carregada |
| 2 | Corrigir inputs | Usar apenas `formData` nos campos (remover fallbacks duplicados) |
| 3 | Aplicar máscara CNPJ | Ao carregar dados, aplicar `maskCNPJ()` no CNPJ existente |
| 4 | Adicionar logs (opcional) | Facilitar debug em caso de problemas futuros |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│                    PÁGINA admin/Empresa                         │
└─────────────────────────────────────────────────────────────────┘
           │
           └── Query busca dados da empresa no Supabase
                   │
                   └── useEffect detecta que `empresa` foi carregada
                           │
                           └── setFormData com todos os campos preenchidos
                                   │
                                   ├── nome_fantasia: empresa.nome_fantasia
                                   ├── cnpj: maskCNPJ(empresa.cnpj)
                                   ├── inscricao_estadual: empresa.inscricao_estadual
                                   ├── endereco_completo: empresa.endereco_completo
                                   └── chave_pix: empresa.chave_pix  ✅
           
           └── Usuário edita os campos
                   │
                   └── Clica em "Salvar Alterações"
                           │
                           └── updateMutation envia todos os dados
                                   │
                                   └── chave_pix: formData.chave_pix  ✅ Agora salva corretamente!
```

---

## Código Final do `useEffect`

```typescript
// Adicionar APÓS a declaração dos estados (linha 57)
useEffect(() => {
  if (empresa) {
    setFormData({
      nome_fantasia: empresa.nome_fantasia || '',
      cnpj: empresa.cnpj ? maskCNPJ(empresa.cnpj) : '',
      inscricao_estadual: empresa.inscricao_estadual || '',
      endereco_completo: empresa.endereco_completo || '',
      chave_pix: empresa.chave_pix || '',
    });
    
    // Carregar configurações de couver do localStorage
    const key = `fcd-live-music-${empresa.id || 'local'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCouverAtivoLocal(parsed.ativo || false);
        setCouverValorLocal(parsed.valor || '0.00');
        setWeekdays(parsed.weekdays || {
          monday: false, tuesday: false, wednesday: false,
          thursday: false, friday: false, saturday: false, sunday: false
        });
        setSpecificDates((parsed.specificDates || []).join(', '));
      } catch (e) {
        console.warn('Erro ao carregar configurações de couver:', e);
      }
    }
  }
}, [empresa]);
```

---

## Seção Técnica

### Por que o problema ocorre?

O React Query carrega os dados de forma assíncrona. Quando o componente renderiza pela primeira vez:
1. `empresa` é `undefined` (query ainda não completou)
2. `formData` é inicializado com strings vazias
3. Quando a query completa, `empresa` recebe os dados, mas `formData` **permanece vazio**

A solução é usar `useEffect` com `empresa` como dependência para sincronizar os dados assim que estiverem disponíveis.

### Campos que precisam de tratamento especial

- **CNPJ**: Armazenado sem máscara no banco (`83888388000188`), precisa de `maskCNPJ()` para exibição
- **Chave PIX**: Suporta múltiplos formatos (CPF, CNPJ, email, telefone, chave aleatória) - não precisa de máscara
