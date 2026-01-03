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

export function useCart(taxaEntrega: number = 0) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((produto: CartItem['produto']) => {
    setCart(prev => {
      const existing = prev.find(item => item.produto.id === produto.id);
      if (existing) {
        return prev.map(item =>
          item.produto.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((produtoId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.produto.id === produtoId);
      if (existing && existing.quantidade > 1) {
        return prev.map(item =>
          item.produto.id === produtoId
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        );
      }
      return prev.filter(item => item.produto.id !== produtoId);
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const getQuantity = useCallback((produtoId: string) => {
    return cart.find(item => item.produto.id === produtoId)?.quantidade || 0;
  }, [cart]);

  const subtotal = useMemo(() => 
    cart.reduce((sum, item) => sum + item.produto.preco * item.quantidade, 0),
    [cart]
  );

  const total = useMemo(() => subtotal + taxaEntrega, [subtotal, taxaEntrega]);

  const itemCount = useMemo(() => 
    cart.reduce((sum, item) => sum + item.quantidade, 0),
    [cart]
  );

  return {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    getQuantity,
    subtotal,
    total,
    itemCount,
  };
}
