import { useEffect } from 'react';
import usePWAManifest from '@/hooks/usePWAManifest';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PWAProviderProps {
  children: React.ReactNode;
  type: 'delivery' | 'admin';
}

export const PWAProvider = ({ children, type }: PWAProviderProps) => {
  usePWAManifest();
  
  const { subscribeToAdminUpdates, permission } = usePushNotifications({ type });

  useEffect(() => {
    if (permission !== 'granted') return;
    if (type !== 'admin') return;

    const unsubscribe = subscribeToAdminUpdates();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [type, permission, subscribeToAdminUpdates]);

  return <>{children}</>;
};

export default PWAProvider;
