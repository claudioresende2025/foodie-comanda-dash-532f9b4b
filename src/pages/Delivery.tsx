import { useDeliveryRestaurants } from '@/hooks/useDeliveryRestaurants';
import { DeliveryHeader } from '@/components/delivery/DeliveryHeader';
import { RestaurantCard } from '@/components/delivery/RestaurantCard';
import { EmptyState } from '@/components/delivery/EmptyState';
import { LoadingSkeleton } from '@/components/delivery/LoadingSkeleton';
import { BottomNavigation } from '@/components/delivery/BottomNavigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Opcional: componente de erro
import { AlertCircle } from "lucide-react";

export default function Delivery() {
  // Adicionei 'error' que deve ser retornado pelo seu useQuery dentro do hook
  const { 
    empresas = [], // Default para array vazio previne erro de .length
    isLoading, 
    isError,
    searchQuery, 
    setSearchQuery, 
    refetch 
  } = useDeliveryRestaurants();

  // 1. Estado de Carregamento
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // 2. Estado de Erro (Novo)
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os restaurantes. Verifique sua conexão.
          </AlertDescription>
        </Alert>
        <button 
          onClick={() => refetch()} 
          className="mt-4 w-full bg-primary text-white p-2 rounded"
        >
          Tentar novamente
        </button>
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
        {/* Verificação segura usando opcional chaining ou default value */}
        {empresas.length === 0 ? (
          <EmptyState onRetry={refetch} />
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
