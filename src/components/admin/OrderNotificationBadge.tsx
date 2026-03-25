import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, X, UtensilsCrossed, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { motion, AnimatePresence } from 'framer-motion';

interface OrderNotification {
  id: string;
  type: 'salon' | 'delivery';
  timestamp: Date;
  preview: string;
}

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();

    const playBeep = (freq: number, delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const startTime = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    };

    playBeep(880, 0);
    playBeep(1100, 0.15);
    playBeep(1320, 0.3);
  } catch (e) {
    // Audio not supported
  }
};

export function OrderNotificationBadge() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const empresaId = profile?.empresa_id;

  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [latestNotification, setLatestNotification] = useState<OrderNotification | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const count = notifications.length;

  // Clear notifications when visiting pedidos pages
  useEffect(() => {
    if (location.pathname.includes('/admin/pedidos')) {
      setNotifications(prev => prev.filter(n => n.type !== 'salon'));
    }
    if (location.pathname.includes('/admin/delivery')) {
      setNotifications(prev => prev.filter(n => n.type !== 'delivery'));
    }
  }, [location.pathname]);

  const handleNewOrder = useCallback((type: 'salon' | 'delivery', preview: string) => {
    const notification: OrderNotification = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      type,
      timestamp: new Date(),
      preview,
    };

    setNotifications(prev => [notification, ...prev].slice(0, 20));
    setLatestNotification(notification);
    setShowPreview(true);
    playNotificationSound();

    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    previewTimeoutRef.current = setTimeout(() => setShowPreview(false), 6000);
  }, []);

  // Realtime: pedidos de salão (INSERT)
  useRealtimeSubscription(
    `order-notif-pedidos-${empresaId}`,
    {
      table: 'pedidos',
      onInsert: (payload) => {
        const pedido = payload.new as any;
        handleNewOrder('salon', `Novo pedido no salão`);
      },
    },
    !!empresaId
  );

  // Realtime: pedidos delivery (INSERT)
  useRealtimeSubscription(
    `order-notif-delivery-${empresaId}`,
    {
      table: 'pedidos_delivery',
      filter: `empresa_id=eq.${empresaId}`,
      onInsert: (payload) => {
        const pedido = payload.new as any;
        const statusLabel = pedido.status === 'pago' ? 'Pago' : 'Novo';
        handleNewOrder('delivery', `${statusLabel} pedido delivery`);
      },
    },
    !!empresaId
  );

  const handleClick = () => {
    setShowPreview(false);
    if (latestNotification?.type === 'delivery') {
      navigate('/admin/delivery');
    } else {
      navigate('/admin/pedidos');
    }
    setNotifications([]);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreview(false);
    setNotifications([]);
  };

  if (!empresaId) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Preview popup */}
      <AnimatePresence>
        {showPreview && latestNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="bg-card border-2 border-primary/30 shadow-xl rounded-2xl p-4 max-w-[280px] cursor-pointer"
            onClick={handleClick}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                latestNotification.type === 'delivery' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'bg-orange-100 text-orange-600'
              }`}>
                {latestNotification.type === 'delivery' 
                  ? <Truck className="h-5 w-5" /> 
                  : <UtensilsCrossed className="h-5 w-5" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {latestNotification.type === 'delivery' ? '🛵 Delivery' : '🍽️ Salão'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {latestNotification.preview}
                </p>
                <p className="text-[10px] text-primary mt-1 font-medium">
                  Toque para ver →
                </p>
              </div>
              <button 
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge button */}
      {count > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <Button
            onClick={handleClick}
            className="h-14 w-14 rounded-full shadow-lg relative"
            size="icon"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
            >
              <Bell className="h-6 w-6" />
            </motion.div>
            <Badge className="absolute -top-1 -right-1 h-6 min-w-[24px] flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold px-1.5">
              {count > 9 ? '9+' : count}
            </Badge>
          </Button>
        </motion.div>
      )}
    </div>
  );
}
