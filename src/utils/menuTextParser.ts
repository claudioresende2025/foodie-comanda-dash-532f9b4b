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
 * Limpa e normaliza o texto OCR
 */
function limparTexto(texto: string): string {
  return texto
    .replace(/[\r\n]+/g, '\n') // Normalizar quebras de linha
    .replace(/[|¦│┃]/g, '') // Remover caracteres de borda de tabela
    .replace(/[-_=]{3,}/g, '\n') // Separadores viram quebras de linha
    .replace(/\s{2,}/g, ' ') // Múltiplos espaços viram um
    .trim();
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
  textoLimpo = textoLimpo.replace(/^[\d\.\)\-*•]+\s*/, '').trim();
  
  // Procurar por separadores comuns entre nome e descrição
  const separadores = [' - ', ': ', ' – ', ' | ', '\n', '. '];
  
  for (const sep of separadores) {
    const idx = textoLimpo.indexOf(sep);
    if (idx > 3 && idx < textoLimpo.length - 3) {
      return {
        nome: textoLimpo.substring(0, idx).trim(),
        descricao: textoLimpo.substring(idx + sep.length).trim(),
      };
    }
  }
  
  // Se não encontrou separador, usar tudo como nome
  // Se for muito longo, tentar dividir
  if (textoLimpo.length > 50) {
    const palavras = textoLimpo.split(' ');
    const meio = Math.min(4, Math.floor(palavras.length / 2));
    return {
      nome: palavras.slice(0, meio).join(' '),
      descricao: palavras.slice(meio).join(' '),
    };
  }
  
  return { nome: textoLimpo, descricao: '' };
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
