import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Location {
  latitude: number;
  longitude: number;
}

interface DeliveryMapProps {
  deliveryLocation: Location | null;
  customerLocation: Location | null;
  restaurantLocation: Location | null;
  restaurantName?: string;
  customerAddress?: string;
}

// Ícones customizados
const createIcon = (emoji: string, color: string) => {
  return L.divIcon({
    html: `<div style="
      background: ${color};
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    className: 'custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const deliveryIcon = createIcon('🛵', '#8B5CF6');
const customerIcon = createIcon('📍', '#22C55E');
const restaurantIcon = createIcon('🍽️', '#F97316');

export function DeliveryMap({
  deliveryLocation,
  customerLocation,
  restaurantLocation,
  restaurantName,
  customerAddress,
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{
    delivery?: L.Marker;
    customer?: L.Marker;
    restaurant?: L.Marker;
  }>({});
  const [mapReady, setMapReady] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Posição padrão (centro do Brasil)
    const defaultCenter: [number, number] = [-15.7801, -47.9292];
    
    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });

    // Usar OpenStreetMap (gratuito)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Atualizar marcadores
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const bounds: L.LatLngExpression[] = [];

    // Marcador do entregador
    if (deliveryLocation) {
      const pos: L.LatLngExpression = [deliveryLocation.latitude, deliveryLocation.longitude];
      bounds.push(pos);
      
      if (markersRef.current.delivery) {
        markersRef.current.delivery.setLatLng(pos);
      } else {
        markersRef.current.delivery = L.marker(pos, { icon: deliveryIcon })
          .addTo(map)
          .bindPopup('<strong>🛵 Entregador</strong><br>A caminho...');
      }
    }

    // Marcador do cliente
    if (customerLocation) {
      const pos: L.LatLngExpression = [customerLocation.latitude, customerLocation.longitude];
      bounds.push(pos);
      
      if (markersRef.current.customer) {
        markersRef.current.customer.setLatLng(pos);
      } else {
        markersRef.current.customer = L.marker(pos, { icon: customerIcon })
          .addTo(map)
          .bindPopup(`<strong>📍 Seu endereço</strong>${customerAddress ? `<br>${customerAddress}` : ''}`);
      }
    }

    // Marcador do restaurante
    if (restaurantLocation) {
      const pos: L.LatLngExpression = [restaurantLocation.latitude, restaurantLocation.longitude];
      bounds.push(pos);
      
      if (markersRef.current.restaurant) {
        markersRef.current.restaurant.setLatLng(pos);
      } else {
        markersRef.current.restaurant = L.marker(pos, { icon: restaurantIcon })
          .addTo(map)
          .bindPopup(`<strong>🍽️ ${restaurantName || 'Restaurante'}</strong>`);
      }
    }

    // Ajustar zoom para mostrar todos os marcadores
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0] as L.LatLngExpression, 16);
      } else {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
      }
    }
  }, [mapReady, deliveryLocation, customerLocation, restaurantLocation, restaurantName, customerAddress]);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full h-64 rounded-lg overflow-hidden border"
        style={{ minHeight: '256px' }}
      />
      
      {/* Legenda */}
      <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm rounded-lg p-2 text-xs shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-[10px]">🛵</span>
          <span>Entregador</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[10px]">📍</span>
          <span>Seu endereço</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[10px]">🍽️</span>
          <span>Restaurante</span>
        </div>
      </div>

      {!deliveryLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
          <div className="text-center p-4">
            <span className="text-2xl mb-2 block">🛵</span>
            <p className="text-sm text-muted-foreground">
              Aguardando localização do entregador...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
