/**
 * Parser de texto OCR para extrair produtos de cardápio
 * Identifica nome do produto, descrição e preço
 */

export interface ProdutoExtraido {
  nome: string;
  descricao: string;
  preco: number;
  confianca: number; // 0-100 - quão confiante estamos na extração
  linhaOriginal: string;
}

/**
 * Padrões comuns de preço em cardápios brasileiros
 */
const PADROES_PRECO = [
  // R$ 25,00 ou R$25,00 ou R$ 25.00
  /R\$\s*(\d{1,4})[,.](\d{2})/gi,
  // 25,00 ou 25.00 (preço sem R$)
  /(\d{1,4})[,.](\d{2})(?=\s*$|\s+)/g,
  // 25,90 no final da linha
  /(\d{1,4})[,.](\d{2})\s*$/g,
];

/**
 * Correções comuns de OCR - caracteres que são frequentemente confundidos
 */
const CORRECOES_OCR: Record<string, string> = {
  '\u00A9': 'C', // Copyright por C
  '\u00AE': 'R', // Registered por R
  '\u2122': 'TM', // Trademark
  '\u00AB': '"', // Aspas «
  '\u00BB': '"', // Aspas »
  '\u2018': "'", // Apóstrofo '
  '\u2019': "'", // Apóstrofo '
  '\u201C': '"', // Aspas "
  '\u201D': '"', // Aspas "
  '\u2013': '-', // Travessão –
  '\u2014': '-', // Travessão longo —
  '\u2026': '...', // Reticências …
  '\u2010': '-', // Hífen ‐
  '\u00AD': '', // Soft hyphen
  '\u00A0': ' ', // Non-breaking space
  '\u200B': '', // Zero-width space
  '\u200C': '', // Zero-width non-joiner
  '\u200D': '', // Zero-width joiner
  '\uFEFF': '', // BOM
};

/**
 * Caracteres de ruído comum do OCR que devem ser removidos
 */
const RUIDO_OCR = /[\u005E\u0060\u007E\u00AC\u00A8\u00B4\u00B0\u00AA\u00BA\u00B9\u00B2\u00B3\u00B1\u00D7\u00F7\u00B6\u00A7\u00A4\u00A2\u00A3\u00A5\u20AC\u00A1\u00BF\u00B7\u2022\u25E6\u25AA\u25B8\u25BA\u25C6\u25C7\u25CB\u25CF\u25A1\u25A0\u25B2\u25B3\u25BC\u25BD\u25C1\u25C0\u2666\u2663\u2660\u2665\u2605\u2606\u2713\u2714\u2715\u2716\u2717\u2718\u2726\u2727\u2729\u272A\u272B\u272C\u272D\u272E\u272F\u2730]/g;

/**
 * Corrige erros comuns de OCR em texto
 */
function corrigirErrosOCR(texto: string): string {
  let resultado = texto;
  
  // Remover caracteres de ruído
  resultado = resultado.replace(RUIDO_OCR, '');
  
  // Aplicar correções de caracteres
  for (const [errado, correto] of Object.entries(CORRECOES_OCR)) {
    resultado = resultado.split(errado).join(correto);
  }
  
  // Corrigir números no meio de palavras (exceto em preços)
  // Ex: "PIZZ4" -> "PIZZA", "HAMBÚRGU3R" -> "HAMBÚRGUER"
  resultado = resultado.replace(/([A-Za-zÀ-ÿ])0([A-Za-zÀ-ÿ])/g, '$1O$2');
  resultado = resultado.replace(/([A-Za-zÀ-ÿ])1([A-Za-zÀ-ÿ])/g, '$1I$2');
  resultado = resultado.replace(/([A-Za-zÀ-ÿ])3([A-Za-zÀ-ÿ])/g, '$1E$2');
  resultado = resultado.replace(/([A-Za-zÀ-ÿ])4([A-Za-zÀ-ÿ])/g, '$1A$2');
  resultado = resultado.replace(/([A-Za-zÀ-ÿ])5([A-Za-zÀ-ÿ])/g, '$1S$2');
  resultado = resultado.replace(/([A-Za-zÀ-ÿ])6([A-Za-zÀ-ÿ])/g, '$1G$2');
  resultado = resultado.replace(/([A-Za-zÀ-ÿ])8([A-Za-zÀ-ÿ])/g, '$1B$2');
  
  // Corrigir sequências problemáticas comuns
  resultado = resultado.replace(/rn/g, 'm'); // rn -> m (quando parece m)
  resultado = resultado.replace(/lI/g, 'U'); // lI -> U
  resultado = resultado.replace(/II/g, 'U'); // II -> U (em alguns casos)
  
  return resultado;
}

/**
 * Limpa nome do produto removendo caracteres inválidos
 */
function limparNomeProduto(nome: string): string {
  let resultado = nome
    // Remover caracteres especiais no início e fim
    .replace(/^[^A-Za-zÀ-ÿ0-9]+/, '')
    .replace(/[^A-Za-zÀ-ÿ0-9]+$/, '')
    // Remover múltiplos espaços
    .replace(/\s{2,}/g, ' ')
    // Remover caracteres de controle
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Manter apenas caracteres válidos para nome de produto
    .replace(/[^\w\sÀ-ÿ\-.,&()'"/]+/g, '')
    .trim();
  
  // Capitalizar corretamente (primeira letra maiúscula de cada palavra principal)
  resultado = resultado
    .toLowerCase()
    .replace(/(?:^|\s)([a-zà-ÿ])/g, (_, letra) => _.toUpperCase());
  
  // Manter palavras como "de", "da", "do", "com", "e" em minúsculo
  resultado = resultado
    .replace(/\s(De|Da|Do|Dos|Das|Com|E|À|Ao|Em)\s/g, (match) => match.toLowerCase());
  
  return resultado;
}

/**
 * Limpa e normaliza o texto OCR
 */
function limparTexto(texto: string): string {
  let resultado = texto
    .replace(/[\r\n]+/g, '\n') // Normalizar quebras de linha
    .replace(/[|¦│┃║]/g, ' ') // Caracteres de borda de tabela viram espaço
    .replace(/[-_=]{3,}/g, '\n') // Separadores viram quebras de linha
    .replace(/\t+/g, ' ') // Tabs viram espaços
    .replace(/\s{2,}/g, ' ') // Múltiplos espaços viram um
    .trim();
  
  // Aplicar correções de OCR
  resultado = corrigirErrosOCR(resultado);
  
  return resultado;
}

/**
 * Extrai o preço de uma linha de texto
 * Retorna o preço como número ou null se não encontrar
 */
function extrairPreco(linha: string): { preco: number; posicao: number } | null {
  // Procurar por padrão R$ primeiro
  const matchComR = linha.match(/R\$\s*(\d{1,4})[,.](\d{2})/i);
  if (matchComR) {
    const preco = parseFloat(`${matchComR[1]}.${matchComR[2]}`);
    return { preco, posicao: matchComR.index || 0 };
  }

  // Procurar por número no formato XX,XX ou XX.XX no final da linha
  const matchSemR = linha.match(/(\d{1,4})[,.](\d{2})\s*$/);
  if (matchSemR) {
    const preco = parseFloat(`${matchSemR[1]}.${matchSemR[2]}`);
    // Verificar se é um preço razoável (entre R$ 1,00 e R$ 999,99)
    if (preco >= 1 && preco <= 999.99) {
      return { preco, posicao: matchSemR.index || 0 };
    }
  }

  // Procurar por qualquer número no formato de preço na linha
  const matchQualquer = linha.match(/(\d{1,4})[,.](\d{2})/);
  if (matchQualquer) {
    const preco = parseFloat(`${matchQualquer[1]}.${matchQualquer[2]}`);
    // Ser mais restritivo para preços sem R$
    if (preco >= 5 && preco <= 500) {
      return { preco, posicao: matchQualquer.index || 0 };
    }
  }

  return null;
}

/**
 * Determina se uma linha parece ser um item de cardápio
 */
function ehItemCardapio(linha: string): boolean {
  // Ignorar linhas muito curtas
  if (linha.length < 5) return false;
  
  // Ignorar linhas que são apenas números ou preços
  if (/^\s*[R$]?\s*\d+[,.]?\d*\s*$/.test(linha)) return false;
  
  // Ignorar cabeçalhos comuns
  const ignorar = [
    /^(cardápio|menu|bebidas|lanches|pratos|sobremesas|combos|porções|pizzas?)$/i,
    /^(categoria|item|preço|valor|descrição|obs|observação)$/i,
    /^(delivery|peça|encomendas?|contato|telefone|whatsapp)/i,
    /^\d+\s*$/,
    /^[*\-•]+\s*$/,
  ];
  
  for (const padrao of ignorar) {
    if (padrao.test(linha.trim())) return false;
  }
  
  return true;
}

/**
 * Tenta extrair nome e descrição de um texto
 */
function extrairNomeDescricao(texto: string, posicaoPreco?: number): { nome: string; descricao: string } {
  let textoLimpo = texto;
  
  // Se temos a posição do preço, remover a partir daí
  if (posicaoPreco !== undefined && posicaoPreco > 0) {
    textoLimpo = texto.substring(0, posicaoPreco).trim();
  }
  
  // Remover símbolos e números do início
  textoLimpo = textoLimpo.replace(/^[\d\.\)\-*•#]+\s*/, '').trim();
  
  // Corrigir erros de OCR no texto
  textoLimpo = corrigirErrosOCR(textoLimpo);
  
  // Procurar por separadores comuns entre nome e descrição
  const separadores = [' - ', ': ', ' – ', ' | ', '\n', '. '];
  
  for (const sep of separadores) {
    const idx = textoLimpo.indexOf(sep);
    if (idx > 3 && idx < textoLimpo.length - 3) {
      const nome = limparNomeProduto(textoLimpo.substring(0, idx));
      const descricao = textoLimpo.substring(idx + sep.length).trim()
        .replace(/[^\w\sÀ-ÿ\-.,&()'"/]+/g, '') // Limpar caracteres especiais
        .trim();
      return { nome, descricao };
    }
  }
  
  // Se não encontrou separador, usar tudo como nome
  // Se for muito longo, tentar dividir
  if (textoLimpo.length > 50) {
    const palavras = textoLimpo.split(' ');
    const meio = Math.min(4, Math.floor(palavras.length / 2));
    const nome = limparNomeProduto(palavras.slice(0, meio).join(' '));
    const descricao = palavras.slice(meio).join(' ')
      .replace(/[^\w\sÀ-ÿ\-.,&()'"/]+/g, '')
      .trim();
    return { nome, descricao };
  }
  
  return { nome: limparNomeProduto(textoLimpo), descricao: '' };
}

/**
 * Função principal: processa texto OCR e extrai produtos
 */
export function extrairProdutosDeTexto(textoOCR: string): ProdutoExtraido[] {
  const produtos: ProdutoExtraido[] = [];
  const textoLimpo = limparTexto(textoOCR);
  const linhas = textoLimpo.split('\n').filter(l => l.trim().length > 0);
  
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i].trim();
    
    if (!ehItemCardapio(linha)) {
      i++;
      continue;
    }
    
    // Tentar extrair preço da linha atual
    let dadosPreco = extrairPreco(linha);
    let linhaCompleta = linha;
    let proximaLinha = '';
    
    // Se não encontrou preço, verificar próxima linha
    if (!dadosPreco && i + 1 < linhas.length) {
      proximaLinha = linhas[i + 1].trim();
      dadosPreco = extrairPreco(proximaLinha);
      
      if (dadosPreco) {
        // Preço estava na próxima linha
        linhaCompleta = `${linha} ${proximaLinha}`;
        i++; // Pular a próxima linha pois já processamos
      }
    }
    
    // Se encontramos um preço válido, extrair o produto
    if (dadosPreco && dadosPreco.preco > 0) {
      const { nome, descricao } = extrairNomeDescricao(linhaCompleta, dadosPreco.posicao);
      
      // Validar nome
      if (nome.length >= 3 && nome.length <= 100) {
        // Calcular confiança baseada em alguns fatores
        let confianca = 60;
        
        // Nome começa com maiúscula = mais confiança
        if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ]/.test(nome)) confianca += 10;
        
        // Tem descrição = mais confiança
        if (descricao.length > 5) confianca += 10;
        
        // Preço tinha R$ = mais confiança
        if (linhaCompleta.includes('R$')) confianca += 15;
        
        // Preço é razoável (entre 5 e 200) = mais confiança
        if (dadosPreco.preco >= 5 && dadosPreco.preco <= 200) confianca += 5;
        
        produtos.push({
          nome: nome.substring(0, 100),
          descricao: descricao.substring(0, 500),
          preco: dadosPreco.preco,
          confianca: Math.min(100, confianca),
          linhaOriginal: linhaCompleta,
        });
      }
    }
    
    i++;
  }
  
  // Ordenar por confiança (maior primeiro)
  produtos.sort((a, b) => b.confianca - a.confianca);
  
  // Remover duplicatas baseado no nome similar
  const produtosUnicos: ProdutoExtraido[] = [];
  for (const produto of produtos) {
    const nomeNormalizado = produto.nome.toLowerCase().replace(/\s+/g, '');
    const jáExiste = produtosUnicos.some(p => {
      const outroNome = p.nome.toLowerCase().replace(/\s+/g, '');
      // Considerar duplicata se nome for muito similar
      return (
        outroNome === nomeNormalizado ||
        outroNome.includes(nomeNormalizado) ||
        nomeNormalizado.includes(outroNome)
      );
    });
    
    if (!jáExiste) {
      produtosUnicos.push(produto);
    }
  }
  
  return produtosUnicos;
}

/**
 * Formata preço para exibição
 */
export function formatarPreco(preco: number): string {
  return preco.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
