import { memo } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CartButtonProps {
  itemCount: number;
  total: number;
  onClick: () => void;
  className?: string;
}

export const CartButton = memo(function CartButton({ 
  itemCount, 
  total, 
  onClick,
  className 
}: CartButtonProps) {
  if (itemCount === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-20 left-0 w-full p-4 z-40",
      "animate-slide-up",
      className
    )}>
      <Button 
        className="w-full max-w-lg mx-auto h-14 font-bold text-lg rounded-2xl shadow-xl flex items-center justify-between px-6"
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShoppingCart className="h-6 w-6" />
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-accent text-accent-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          </div>
          <span>Ver Carrinho</span>
        </div>
        <span>R$ {total.toFixed(2)}</span>
      </Button>
    </div>
  );
});
