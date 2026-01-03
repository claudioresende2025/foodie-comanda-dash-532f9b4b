import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PushNotificationConfig {
  type: 'delivery' | 'admin';
}

export const usePushNotifications = ({ type }: PushNotificationConfig) => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Notificações não suportadas neste navegador');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        toast.success('Notificações ativadas!');
        return true;
      } else if (result === 'denied') {
        toast.error('Notificações bloqueadas. Ative nas configurações do navegador.');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Erro ao solicitar permissão para notificações');
      return false;
    }
  }, [isSupported]);

  const subscribeToNotifications = useCallback(async () => {
    if (!isSupported || permission !== 'granted') {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let pushSubscription = await registration.pushManager.getSubscription();
      
      if (!pushSubscription) {
        // For demo purposes, we're using a placeholder VAPID key
        // In production, you'd need to generate proper VAPID keys
        console.log('Push notifications require VAPID keys to be configured');
      }
      
      setSubscription(pushSubscription);
      return pushSubscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }, [isSupported, permission]);

  const showLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: type === 'delivery' ? '/delivery-icon-192.png' : '/admin-icon-192.png',
      badge: type === 'delivery' ? '/delivery-icon-192.png' : '/admin-icon-192.png',
      tag: `${type}-notification`,
      ...options
    };

    // Use service worker to show notification (works even when tab is not focused)
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, defaultOptions);
    }).catch(() => {
      // Fallback to regular Notification API
      new Notification(title, defaultOptions);
    });
  }, [isSupported, permission, type]);

  // Delivery-specific: Subscribe to order updates
  const subscribeToDeliveryUpdates = useCallback((orderId: string) => {
    if (!user || !orderId) return () => {};

    const channel = supabase
      .channel(`delivery-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos_delivery',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status;
          if (!newStatus) return;
          
          const statusMessages: Record<string, string> = {
            confirmado: 'Seu pedido foi confirmado!',
            em_preparo: 'Seu pedido está sendo preparado!',
            saiu_entrega: 'Seu pedido saiu para entrega!',
            entregue: 'Seu pedido foi entregue!'
          };

          const message = statusMessages[newStatus];
          if (message) {
            showLocalNotification('Food Delivery', {
              body: message,
              data: { orderId, status: newStatus }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showLocalNotification]);

  // Admin-specific: Subscribe to new orders and waiter calls
  const subscribeToAdminUpdates = useCallback(() => {
    if (!profile?.empresa_id) return () => {};

    const empresaId = profile.empresa_id;
    
    const deliveryChannel = supabase
      .channel(`admin-delivery-orders-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos_delivery',
          filter: `empresa_id=eq.${empresaId}`
        },
        () => {
          showLocalNotification('Novo Pedido Delivery!', {
            body: 'Você recebeu um novo pedido de delivery',
            data: { type: 'new_delivery_order' }
          });
        }
      )
      .subscribe();

    const waiterChannel = supabase
      .channel(`admin-waiter-calls-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chamadas_garcom',
          filter: `empresa_id=eq.${empresaId}`
        },
        (payload) => {
          const mesaId = (payload.new as { mesa_id?: string }).mesa_id;
          showLocalNotification('Chamada de Garçom!', {
            body: `Mesa chamando - Atenda o cliente`,
            data: { type: 'waiter_call', mesaId }
          });
        }
      )
      .subscribe();

    const mesaOrdersChannel = supabase
      .channel(`admin-mesa-orders-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos'
        },
        () => {
          showLocalNotification('Novo Pedido!', {
            body: 'Novo pedido recebido de mesa',
            data: { type: 'new_mesa_order' }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deliveryChannel);
      supabase.removeChannel(waiterChannel);
      supabase.removeChannel(mesaOrdersChannel);
    };
  }, [profile?.empresa_id, showLocalNotification]);

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribeToNotifications,
    showLocalNotification,
    subscribeToDeliveryUpdates,
    subscribeToAdminUpdates
  };
};

export default usePushNotifications;
