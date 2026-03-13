import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';

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
  showRoute?: boolean;
}

// Função auxiliar para ajustar cor
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Ícones customizados com animação
const createIcon = (emoji: string, color: string, isAnimated: boolean = false) => {
  return L.divIcon({
    html: `
      <div class="marker-container ${isAnimated ? 'animated-marker' : ''}">
        <div style="
          background: linear-gradient(135deg, ${color}, ${adjustColor(color, -20)});
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        ">${emoji}</div>
        ${isAnimated ? `
          <div class="ripple-effect" style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 2px solid ${color};
            opacity: 0.5;
          "></div>
        ` : ''}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const deliveryIcon = createIcon('🛵', '#8B5CF6', true);
const customerIcon = createIcon('🏠', '#22C55E', false);
const restaurantIcon = createIcon('🍽️', '#F97316', false);

// CSS para animações
const mapStyles = `
  .animated-marker > div:first-child {
    animation: pulse 2s infinite;
  }
  .ripple-effect {
    animation: ripple 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    50% { transform: scale(1.1); box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5); }
  }
  @keyframes ripple {
    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; }
    100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
  }
  .leaflet-marker-icon {
    transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
  }
  .marker-container {
    position: relative;
  }
  /* Garantir que o mapa não sobreponha o cabeçalho */
  .leaflet-container {
    z-index: 1 !important;
  }
  .leaflet-pane {
    z-index: 1 !important;
  }
  .leaflet-top, .leaflet-bottom {
    z-index: 10 !important;
  }
  .leaflet-control {
    z-index: 10 !important;
  }
`;

export function DeliveryMap({
  deliveryLocation,
  customerLocation,
  restaurantLocation,
  restaurantName,
  customerAddress,
  showRoute = true,
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{
    delivery?: L.Marker;
    customer?: L.Marker;
    restaurant?: L.Marker;
  }>({});
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);

  // Determinar centro inicial baseado nas localizações disponíveis
  useEffect(() => {
    if (initialCenter) return; // Já definido
    
    if (deliveryLocation) {
      setInitialCenter([deliveryLocation.latitude, deliveryLocation.longitude]);
    } else if (customerLocation) {
      setInitialCenter([customerLocation.latitude, customerLocation.longitude]);
    } else if (restaurantLocation) {
      setInitialCenter([restaurantLocation.latitude, restaurantLocation.longitude]);
    } else {
      // Tentar usar geolocalização do dispositivo como última opção
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setInitialCenter([pos.coords.latitude, pos.coords.longitude]);
          },
          () => {
            // Fallback para um ponto neutro (centro do Brasil)
            setInitialCenter([-15.7801, -47.9292]);
          },
          { timeout: 5000 }
        );
      } else {
        setInitialCenter([-15.7801, -47.9292]);
      }
    }
  }, [deliveryLocation, customerLocation, restaurantLocation, initialCenter]);

  // Injetar CSS de animações
  useEffect(() => {
    const styleId = 'delivery-map-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = mapStyles;
      document.head.appendChild(style);
    }
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !initialCenter) return;

    const map = L.map(mapRef.current, {
      center: initialCenter,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    // Controle de zoom em posição customizada
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Tiles mais modernos (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);
    setTimeout(() => setIsLoading(false), 500);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [initialCenter]);

  // Função para animar movimento do marcador (smooth transition)
  const animateMarker = (marker: L.Marker, newPos: L.LatLng, duration: number = 1000) => {
    const startPos = marker.getLatLng();
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const lat = startPos.lat + (newPos.lat - startPos.lat) * easeProgress;
      const lng = startPos.lng + (newPos.lng - startPos.lng) * easeProgress;
      
      marker.setLatLng([lat, lng]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };

  // Atualizar marcadores com animação suave
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const bounds: L.LatLngExpression[] = [];

    // Marcador do entregador com animação suave
    if (deliveryLocation) {
      const pos = L.latLng(deliveryLocation.latitude, deliveryLocation.longitude);
      bounds.push([deliveryLocation.latitude, deliveryLocation.longitude]);
      
      if (markersRef.current.delivery) {
        animateMarker(markersRef.current.delivery, pos, 1000);
      } else {
        markersRef.current.delivery = L.marker([deliveryLocation.latitude, deliveryLocation.longitude], { 
          icon: deliveryIcon,
          zIndexOffset: 1000
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 8px;">
              <strong style="font-size: 16px;">🛵 Entregador</strong>
              <br>
              <span style="color: #8B5CF6; font-weight: bold;">A caminho da sua entrega!</span>
            </div>
          `);
      }
    }

    // Marcador do cliente
    if (customerLocation) {
      const pos: L.LatLngExpression = [customerLocation.latitude, customerLocation.longitude];
      bounds.push(pos);
      
      if (!markersRef.current.customer) {
        markersRef.current.customer = L.marker(pos, { icon: customerIcon })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 8px;">
              <strong style="font-size: 16px;">🏠 Seu Endereço</strong>
              ${customerAddress ? `<br><span style="color: #666;">${customerAddress}</span>` : ''}
            </div>
          `);
      }
    }

    // Marcador do restaurante
    if (restaurantLocation) {
      const pos: L.LatLngExpression = [restaurantLocation.latitude, restaurantLocation.longitude];
      bounds.push(pos);
      
      if (!markersRef.current.restaurant) {
        markersRef.current.restaurant = L.marker(pos, { icon: restaurantIcon })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 8px;">
              <strong style="font-size: 16px;">🍽️ ${restaurantName || 'Restaurante'}</strong>
            </div>
          `);
      }
    }

    // Desenhar linha de rota (pontilhada)
    if (showRoute && deliveryLocation && customerLocation) {
      const routePoints: L.LatLngExpression[] = [
        [deliveryLocation.latitude, deliveryLocation.longitude],
        [customerLocation.latitude, customerLocation.longitude]
      ];

      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(routePoints);
      } else {
        routeLineRef.current = L.polyline(routePoints, {
          color: '#8B5CF6',
          weight: 3,
          opacity: 0.6,
          dashArray: '10, 10',
          lineCap: 'round',
        }).addTo(map);
      }
    }

    // Ajustar zoom para mostrar todos os marcadores
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0] as L.LatLngExpression, 16, { animate: true });
      } else {
        map.fitBounds(L.latLngBounds(bounds), { 
          padding: [60, 60],
          animate: true,
          duration: 0.5
        });
      }
    }
  }, [mapReady, deliveryLocation, customerLocation, restaurantLocation, restaurantName, customerAddress, showRoute]);

  // Calcular distância aproximada
  const getDistance = (): string | null => {
    if (!deliveryLocation || !customerLocation) return null;
    
    const R = 6371;
    const dLat = (customerLocation.latitude - deliveryLocation.latitude) * Math.PI / 180;
    const dLon = (customerLocation.longitude - deliveryLocation.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deliveryLocation.latitude * Math.PI / 180) * 
      Math.cos(customerLocation.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const distance = getDistance();

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg border-2 border-primary/20" style={{ zIndex: 0 }}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Carregando mapa...</p>
          </div>
        </div>
      )}

      {/* Mapa */}
      <div
        ref={mapRef}
        className="w-full h-72 md:h-80"
        style={{ minHeight: '288px', zIndex: 0 }}
      />
      
      {/* Badge de distância */}
      {distance && deliveryLocation && (
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-primary">{distance}</span>
            <span className="text-xs text-muted-foreground">de distância</span>
          </div>
        </div>
      )}
      
      {/* Legenda moderna */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-xs shadow">
              🛵
            </div>
            <span className="text-xs font-medium">Entregador</span>
            {deliveryLocation && (
              <span className="text-[10px] text-green-600 font-semibold ml-auto">AO VIVO</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-xs shadow">
              🏠
            </div>
            <span className="text-xs font-medium">Seu endereço</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-xs shadow">
              🍽️
            </div>
            <span className="text-xs font-medium">Restaurante</span>
          </div>
        </div>
      </div>

      {/* Overlay quando não há localização DO ENTREGADOR */}
      {!deliveryLocation && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-b from-black/40 via-black/60 to-black/80">
          <div className="text-center p-6 max-w-xs bg-white rounded-2xl shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg">
              <span className="text-4xl animate-bounce">🛵</span>
            </div>
            <h3 className="font-bold text-xl mb-2 text-gray-800">Aguardando Entregador</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              O entregador ainda não compartilhou sua localização.
              Assim que ele sair, você poderá acompanhar em tempo real.
            </p>
            <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded-xl">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                <span className="text-xs font-medium text-purple-700">Aguardando sinal do GPS...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
