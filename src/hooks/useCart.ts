import { useState, useCallback, useMemo } from 'react';

export interface CartItem {
  produto: {
    id: string;
    nome: string;
    descricao: string | null;
    preco: number;
    imagem_url: string | null;
  };
  quantidade: number;
}

const MAX_QUANTITY = 99;
const MIN_QUANTITY = 1;

export function useCart(taxaEntrega: number = 0) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((produto: CartItem['produto'], quantidade: number = 1) => {
    // Validação: quantidade deve ser positiva e inteira
    if (!Number.isInteger(quantidade) || quantidade < MIN_QUANTITY) {
      console.warn('[useCart] Quantidade inválida:', quantidade);
      return;
    }
    
    // Validação: limitar quantidade máxima
    const qtdFinal = Math.min(quantidade, MAX_QUANTITY);

    setCart(prev => {
      const existing = prev.find(item => item.produto.id === produto.id);
      if (existing) {
        const novaQtd = Math.min(existing.quantidade + qtdFinal, MAX_QUANTITY);
        return prev.map(item =>
          item.produto.id === produto.id
            ? { ...item, quantidade: novaQtd }
            : item
        );
      }
      return [...prev, { produto, quantidade: qtdFinal }];
    });
  }, []);

  const removeFromCart = useCallback((produtoId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.produto.id === produtoId);
      if (existing && existing.quantidade > MIN_QUANTITY) {
        return prev.map(item =>
          item.produto.id === produtoId
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        );
      }
      return prev.filter(item => item.produto.id !== produtoId);
    });
  }, []);

  const setQuantity = useCallback((produtoId: string, quantidade: number) => {
    // Validação: não permitir valores negativos ou não-inteiros
    if (!Number.isInteger(quantidade)) {
      console.warn('[useCart] Quantidade deve ser inteira:', quantidade);
      return;
    }
    
    if (quantidade <= 0) {
      // Remover item se quantidade for 0 ou menor
      setCart(prev => prev.filter(item => item.produto.id !== produtoId));
      return;
    }
    
    // Limitar ao máximo
    const qtdFinal = Math.min(quantidade, MAX_QUANTITY);
    
    setCart(prev => prev.map(item =>
      item.produto.id === produtoId
        ? { ...item, quantidade: qtdFinal }
        : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const getQuantity = useCallback((produtoId: string) => {
    return cart.find(item => item.produto.id === produtoId)?.quantidade || 0;
  }, [cart]);

  const subtotal = useMemo(() => 
    cart.reduce((sum, item) => {
      const preco = Number(item.produto.preco) || 0;
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
    subtotal,
    total,
    itemCount,
  };
}
