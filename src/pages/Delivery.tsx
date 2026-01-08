import { useDeliveryRestaurants } from '@/hooks/useDeliveryRestaurants';
import { DeliveryHeader } from '@/components/delivery/DeliveryHeader';
import { RestaurantCard } from '@/components/delivery/RestaurantCard';
import { EmptyState } from '@/components/delivery/EmptyState';
import { LoadingSkeleton } from '@/components/delivery/LoadingSkeleton';
import { BottomNavigation } from '@/components/delivery/BottomNavigation';
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from 'react';

export default function Delivery() {
  const { 
    empresas = [], 
    isLoading, 
    searchQuery, 
    setSearchQuery, 
    refetch 
  } = useDeliveryRestaurants();

  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('[Delivery] render, empresas count:', (empresas || []).length);
      setPageError(null);
    } catch (err: any) {
      console.error('[Delivery] render error:', err);
      setPageError(String(err?.message || err));
    }
  }, [empresas]);

  // Se estiver carregando, mostra o esqueleto
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-lg font-bold mb-2">Erro ao carregar a página Delivery</h2>
          <p className="text-sm text-muted-foreground mb-4">{pageError}</p>
          <div className="flex items-center justify-center gap-2">
            <button className="btn" onClick={() => window.location.reload()}>Recarregar</button>
            <button className="btn" onClick={() => refetch()}>Tentar novamente</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <DeliveryHeader 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery} 
      />

      <main className="container mx-auto px-4 py-6">
        {/* Adicionamos uma verificação extra de segurança */}
        {!empresas || empresas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
             <EmptyState onRetry={refetch} />
             <p className="text-xs text-muted-foreground mt-4">
               Verificando disponibilidade para o seu perfil...
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {empresas.map((empresa) => (
              <RestaurantCard key={empresa.id} empresa={empresa} />
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
