import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ThemeToggleProps {
  variant?: 'icon' | 'button';
  size?: 'sm' | 'default';
}

export function ThemeToggle({ variant = 'icon', size = 'default' }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("fcd-settings");
      if (saved) {
        const settings = JSON.parse(saved);
        return settings.darkTheme ?? false;
      }
    } catch (e) {
      console.warn('Erro ao ler tema:', e);
    }
    return document.documentElement.classList.contains('dark');
  });

  // Sincronizar com localStorage/classe
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Ouvir mudanças do Configuracoes.tsx
  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.darkTheme === 'boolean') {
        setIsDark(customEvent.detail.darkTheme);
      }
    };

    const handleStorage = () => {
      try {
        const saved = localStorage.getItem("fcd-settings");
        if (saved) {
          const settings = JSON.parse(saved);
          setIsDark(settings.darkTheme ?? false);
        }
      } catch (e) {
        console.warn('Erro ao ler tema:', e);
      }
    };

    window.addEventListener('fcd-settings-changed', handleSettingsChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('fcd-settings-changed', handleSettingsChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggleTheme = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    
    // Persistir no localStorage
    try {
      const saved = localStorage.getItem("fcd-settings");
      const settings = saved ? JSON.parse(saved) : {};
      settings.darkTheme = newValue;
      localStorage.setItem("fcd-settings", JSON.stringify(settings));
      
      // Disparar evento para sincronizar com Configuracoes.tsx
      window.dispatchEvent(new CustomEvent('fcd-settings-changed', { detail: settings }));
    } catch (e) {
      console.warn('Erro ao salvar tema:', e);
    }
  };

  const IconComponent = isDark ? Sun : Moon;
  const label = isDark ? 'Modo claro' : 'Modo escuro';

  if (variant === 'button') {
    return (
      <Button
        variant="ghost"
        size={size}
        onClick={toggleTheme}
        className="text-sidebar-foreground hover:bg-sidebar-accent"
      >
        <IconComponent className="w-4 h-4 mr-2" />
        {label}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9"
        >
          <IconComponent className="h-4 w-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
