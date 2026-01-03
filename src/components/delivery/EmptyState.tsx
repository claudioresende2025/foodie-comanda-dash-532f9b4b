import { memo } from 'react';
import { Store, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onRetry?: () => void;
}

export const EmptyState = memo(function EmptyState({ onRetry }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <Store className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Nenhum restaurante disponível</h2>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Não há restaurantes com delivery ativo no momento
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
});
