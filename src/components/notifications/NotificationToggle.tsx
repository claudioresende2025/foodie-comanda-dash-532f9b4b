import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface NotificationToggleProps {
  type: 'delivery' | 'admin';
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export const NotificationToggle = ({ 
  type, 
  variant = 'ghost', 
  size = 'icon',
  showLabel = false,
  className = ''
}: NotificationToggleProps) => {
  const { isSupported, permission, requestPermission } = usePushNotifications({ type });

  if (!isSupported) {
    return null;
  }

  const isEnabled = permission === 'granted';
  const isDenied = permission === 'denied';

  const handleClick = async () => {
    await requestPermission();
  };

  if (isDenied) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        title="Notificações bloqueadas. Ative nas configurações do navegador."
        className={`text-muted-foreground ${className}`}
      >
        <BellOff className="h-5 w-5" />
        {showLabel && <span className="ml-2">Bloqueado</span>}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      title={isEnabled ? 'Notificações ativadas' : 'Ativar notificações'}
      className={`${isEnabled ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''} ${className}`}
    >
      {isEnabled ? (
        <Bell className="h-5 w-5" />
      ) : (
        <BellOff className="h-5 w-5" />
      )}
      {showLabel && (
        <span className="ml-2">
          {isEnabled ? 'Ativado' : 'Ativar'}
        </span>
      )}
    </Button>
  );
};

export default NotificationToggle;
