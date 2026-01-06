import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionStatus {
  blocked: boolean;
  status: string;
  reason?: string;
  trial_ends_at?: string;
  days_remaining?: number;
}

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

// Componente simplificado - funciona sem verificação de assinatura
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  return <>{children}</>;
}

// Hook simplificado para usar em qualquer lugar
export function useSubscription() {
  const { profile } = useAuth();

  return {
    status: { blocked: false, status: 'active' } as SubscriptionStatus,
    isLoading: false,
    isBlocked: false,
    isTrialing: false,
    isActive: true,
    daysRemaining: 30,
    refetch: () => {},
  };
}
