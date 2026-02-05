import { useState, useCallback, useMemo } from 'react';

// Tipo para variações de tamanho
export interface VariacaoTamanho {
  nome: string;
  preco: number;
}

export interface CartItem {
  produto: {
    id: string;
    nome: string;
    descricao: string | null;
    preco: number;
    imagem_url: string | null;
    variacoes?: VariacaoTamanho[] | null;
  };
  quantidade: number;
  // Campos para variação de tamanho selecionada
  tamanhoSelecionado?: string | null;
  precoUnitario: number; // Preço real do item (pode ser da variação)
  cartKey: string; // Chave única: id + tamanho (se houver)
}

const MAX_QUANTITY = 99;
const MIN_QUANTITY = 1;

// Função para gerar chave única do item no carrinho
const gerarCartKey = (produtoId: string, tamanho?: string | null): string => {
  return tamanho ? `${produtoId}__${tamanho}` : produtoId;
};

export function useCart(taxaEntrega: number = 0) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((
    produto: CartItem['produto'], 
    quantidade: number = 1,
    tamanhoSelecionado?: string | null,
    precoVariacao?: number
  ) => {
    // Validação: quantidade deve ser positiva e inteira
    if (!Number.isInteger(quantidade) || quantidade < MIN_QUANTITY) {
      console.warn('[useCart] Quantidade inválida:', quantidade);
      return;
    }
    
    // Validação: limitar quantidade máxima
    const qtdFinal = Math.min(quantidade, MAX_QUANTITY);
    
    // Determinar preço unitário (variação ou preço único)
    const precoUnitario = precoVariacao ?? produto.preco;
    
    // Gerar chave única
    const cartKey = gerarCartKey(produto.id, tamanhoSelecionado);

    setCart(prev => {
      const existing = prev.find(item => item.cartKey === cartKey);
      if (existing) {
        const novaQtd = Math.min(existing.quantidade + qtdFinal, MAX_QUANTITY);
        return prev.map(item =>
          item.cartKey === cartKey
            ? { ...item, quantidade: novaQtd }
            : item
        );
      }
      return [...prev, { 
        produto, 
        quantidade: qtdFinal, 
        tamanhoSelecionado, 
        precoUnitario, 
        cartKey 
      }];
    });
  }, []);

  const removeFromCart = useCallback((cartKey: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.cartKey === cartKey);
      if (existing && existing.quantidade > MIN_QUANTITY) {
        return prev.map(item =>
          item.cartKey === cartKey
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        );
      }
      return prev.filter(item => item.cartKey !== cartKey);
    });
  }, []);

  const setQuantity = useCallback((cartKey: string, quantidade: number) => {
    // Validação: não permitir valores negativos ou não-inteiros
    if (!Number.isInteger(quantidade)) {
      console.warn('[useCart] Quantidade deve ser inteira:', quantidade);
      return;
    }
    
    if (quantidade <= 0) {
      // Remover item se quantidade for 0 ou menor
      setCart(prev => prev.filter(item => item.cartKey !== cartKey));
      return;
    }
    
    // Limitar ao máximo
    const qtdFinal = Math.min(quantidade, MAX_QUANTITY);
    
    setCart(prev => prev.map(item =>
      item.cartKey === cartKey
        ? { ...item, quantidade: qtdFinal }
        : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Para produtos SEM variação - compatibilidade
  const getQuantity = useCallback((produtoId: string) => {
    // Soma todas as quantidades de variações do mesmo produto
    return cart
      .filter(item => item.produto.id === produtoId)
      .reduce((sum, item) => sum + item.quantidade, 0);
  }, [cart]);

  // Para produtos COM variação - busca por cartKey
  const getQuantityByKey = useCallback((cartKey: string) => {
    return cart.find(item => item.cartKey === cartKey)?.quantidade || 0;
  }, [cart]);

  const subtotal = useMemo(() => 
    cart.reduce((sum, item) => {
      const preco = Number(item.precoUnitario) || 0;
      const qtd = Number(item.quantidade) || 0;
      // Validação adicional: preço não pode ser negativo
      if (preco < 0 || qtd < 0) return sum;
      return sum + (preco * qtd);
    }, 0),
    [cart]
  );

  const total = useMemo(() => {
    const sub = Number(subtotal) || 0;
    const taxa = Number(taxaEntrega) || 0;
    // Validação: taxa não pode ser negativa
    return sub + Math.max(0, taxa);
  }, [subtotal, taxaEntrega]);

  const itemCount = useMemo(() => 
    cart.reduce((sum, item) => sum + item.quantidade, 0),
    [cart]
  );

  return {
    cart,
    addToCart,
    removeFromCart,
    setQuantity,
    clearCart,
    getQuantity,
    getQuantityByKey,
    subtotal,
    total,
    itemCount,
  };
}
