import { useState, useCallback } from 'react';

interface GeocodingResult {
  latitude: number;
  longitude: number;
}

/**
 * Hook para fazer geocoding de endereços usando Nominatim (OpenStreetMap)
 * Gratuito e sem necessidade de API key
 */
export function useGeocoding() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocodeAddress = useCallback(async (
    rua: string,
    numero: string,
    bairro: string,
    cidade: string,
    estado: string
  ): Promise<GeocodingResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Montar endereço completo para busca
      const address = `${rua}, ${numero}, ${bairro}, ${cidade}, ${estado}, Brasil`;
      const encodedAddress = encodeURIComponent(address);

      // Usar Nominatim do OpenStreetMap (gratuito)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FoodieComanda/1.0', // Requerido pelo Nominatim
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar localização');
      }

      const data = await response.json();

      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }

      // Se não encontrou o endereço completo, tenta com cidade e estado
      const fallbackAddress = `${cidade}, ${estado}, Brasil`;
      const fallbackResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackAddress)}&limit=1`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FoodieComanda/1.0',
          },
        }
      );

      const fallbackData = await fallbackResponse.json();
      if (fallbackData && fallbackData.length > 0) {
        return {
          latitude: parseFloat(fallbackData[0].lat),
          longitude: parseFloat(fallbackData[0].lon),
        };
      }

      setError('Endereço não encontrado');
      return null;
    } catch (err) {
      console.error('Erro no geocoding:', err);
      setError('Erro ao buscar localização');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { geocodeAddress, isLoading, error };
}
