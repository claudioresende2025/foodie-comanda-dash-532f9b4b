import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// VAPID Public Key from environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

interface PushNotificationConfig {
  type: 'delivery' | 'admin';
}

// Helper to convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = ({ type }: PushNotificationConfig) => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { user, profile } = useAuth();
  
  // Debounce ref for edge function calls
  const lastPushCallRef = useRef<number>(0);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      
      // Check for existing subscription
      navigator.serviceWorker.ready.then(async (registration) => {
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          setSubscription(existingSubscription);
        }
      });
    }
  }, []);

  // Listen for subscription change messages from SW
  useEffect(() => {
    if (!isSupported) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        console.log('[Push] Subscription changed, need to resubscribe');
        setSubscription(null);
        // Auto-resubscribe if we have permission
        if (permission === 'granted') {
          subscribeToNotifications();
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [isSupported, permission]);

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
        // Auto-subscribe after permission granted
        await subscribeToNotifications();
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

  const subscribeToNotifications = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isSupported || permission !== 'granted') {
      return null;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VAPID_PUBLIC_KEY not configured');
      return null;
    }

    if (isSubscribing) {
      return subscription;
    }

    setIsSubscribing(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let pushSubscription = await registration.pushManager.getSubscription();
      
      if (!pushSubscription) {
        // Create new subscription with VAPID key
        console.log('[Push] Creating new subscription with VAPID key');
        pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        console.log('[Push] Subscription created:', pushSubscription.endpoint);
      }
      
      setSubscription(pushSubscription);

      // Save subscription to database
      if (user && pushSubscription) {
        const subscriptionJson = pushSubscription.toJSON();
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            empresa_id: type === 'admin' ? profile?.empresa_id : null,
            endpoint: pushSubscription.endpoint,
            p256dh: subscriptionJson.keys?.p256dh || '',
            auth_key: subscriptionJson.keys?.auth || '',
            type: type,
            user_agent: navigator.userAgent
          }, {
            onConflict: 'endpoint'
          });

        if (error) {
          console.error('[Push] Error saving subscription:', error);
        } else {
          console.log('[Push] Subscription saved to database');
        }
      }

      return pushSubscription;
    } catch (error) {
      console.error('[Push] Error subscribing to push notifications:', error);
      toast.error('Erro ao ativar notificações push');
      return null;
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported, permission, isSubscribing, subscription, user, profile?.empresa_id, type]);

  // Unsubscribe from push notifications
  const unsubscribeFromNotifications = useCallback(async (): Promise<boolean> => {
    if (!subscription) return true;

    try {
      await subscription.unsubscribe();
      setSubscription(null);

      // Remove from database
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
      }

      console.log('[Push] Unsubscribed successfully');
      return true;
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      return false;
    }
  }, [subscription, user]);

  // Send push notification via edge function (for notifying ALL devices)
  const sendPushToAllDevices = useCallback(async (
    title: string,
    body: string,
    options?: { url?: string; tag?: string; data?: Record<string, unknown> }
  ): Promise<boolean> => {
    if (!profile?.empresa_id) {
      console.warn('[Push] No empresa_id available');
      return false;
    }

    // Debounce: prevent multiple calls within 500ms
    const now = Date.now();
    if (now - lastPushCallRef.current < 500) {
      console.log('[Push] Debounced - too many calls');
      return false;
    }
    lastPushCallRef.current = now;

    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          empresa_id: profile.empresa_id,
          title,
          body,
          type: type,
          url: options?.url || '/admin',
          tag: options?.tag,
          data: options?.data
        }
      });

      if (error) {
        console.error('[Push] Error calling edge function:', error);
        return false;
      }

      console.log('[Push] Push notifications sent successfully');
      return true;
    } catch (error) {
      console.error('[Push] Error sending push:', error);
      return false;
    }
  }, [profile?.empresa_id, type]);

  const showLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: type === 'delivery' ? '/delivery-icon-192.png' : '/pwa-icon-192.png',
      badge: type === 'delivery' ? '/delivery-icon-192.png' : '/pwa-icon-192.png',
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
            pago: 'Pagamento PIX confirmado! Seu pedido será preparado.',
            confirmado: 'Seu pedido foi confirmado!',
            em_preparo: 'Seu pedido está sendo preparado!',
            saiu_entrega: 'Seu pedido saiu para entrega!',
            entregue: 'Seu pedido foi entregue!'
          };

          const message = statusMessages[newStatus];
          if (message) {
            showLocalNotification('Food Delivery', {
              body: message,
              data: { orderId, status: newStatus },
              requireInteraction: newStatus === 'pago'
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
  // Also sends push notifications to ALL admin devices (even closed) via edge function
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
          // Local notification (for current tab)
          showLocalNotification('Novo Pedido Delivery!', {
            body: 'Você recebeu um novo pedido de delivery',
            data: { type: 'new_delivery_order' }
          });
          
          // Push to ALL devices (even closed) via edge function
          sendPushToAllDevices(
            '🛵 Novo Pedido Delivery!',
            'Você recebeu um novo pedido de delivery',
            { url: '/admin/pedidos', tag: 'new-delivery-order' }
          );
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
          
          // Push to ALL devices
          sendPushToAllDevices(
            '🔔 Chamada de Garçom!',
            'Mesa chamando - Atenda o cliente',
            { url: '/admin/mesas', tag: 'waiter-call' }
          );
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
          
          // Push to ALL devices
          sendPushToAllDevices(
            '🍽️ Novo Pedido de Mesa!',
            'Novo pedido recebido',
            { url: '/admin/pedidos', tag: 'new-mesa-order' }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deliveryChannel);
      supabase.removeChannel(waiterChannel);
      supabase.removeChannel(mesaOrdersChannel);
    };
  }, [profile?.empresa_id, showLocalNotification, sendPushToAllDevices]);

  // Notificação específica para confirmação de PIX
  const notifyPixConfirmed = useCallback(() => {
    showLocalNotification('Pagamento Confirmado!', {
      body: 'Seu pagamento PIX foi recebido. O restaurante vai preparar seu pedido!',
      tag: 'pix-confirmed',
      requireInteraction: true
    });
  }, [showLocalNotification]);

  return {
    isSupported,
    permission,
    subscription,
    isSubscribing,
    requestPermission,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    showLocalNotification,
    sendPushToAllDevices,
    subscribeToDeliveryUpdates,
    subscribeToAdminUpdates,
    notifyPixConfirmed
  };
};

export default usePushNotifications;
