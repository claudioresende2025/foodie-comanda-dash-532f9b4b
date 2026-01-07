import { useDeliveryRestaurants } from '@/hooks/useDeliveryRestaurants';
import { DeliveryHeader } from '@/components/delivery/DeliveryHeader';
import { RestaurantCard } from '@/components/delivery/RestaurantCard';
import { EmptyState } from '@/components/delivery/EmptyState';
import { LoadingSkeleton } from '@/components/delivery/LoadingSkeleton';
import { BottomNavigation } from '@/components/delivery/BottomNavigation';
import { AlertCircle } from "lucide-react";

export default function Delivery() {
  const { 
    empresas = [], 
    isLoading, 
    searchQuery, 
    setSearchQuery, 
    refetch 
  } = useDeliveryRestaurants();

  // Se estiver carregando, mostra o esqueleto
  if (isLoading) {
    return <LoadingSkeleton />;
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
