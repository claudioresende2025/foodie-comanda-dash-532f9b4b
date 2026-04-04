import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type SubscriptionConfig = {
  table: string;
  filter?: string;
  schema?: string;
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<any>) => void;
};

/**
 * Custom hook for managing Supabase realtime subscriptions
 * Handles cleanup automatically to prevent memory leaks
 */
export function useRealtimeSubscription(
  channelName: string,
  config: SubscriptionConfig,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    // Clean up any existing subscription before creating a new one
    cleanup();

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: config.schema || 'public',
          table: config.table,
          ...(config.filter && { filter: config.filter }),
        },
        (payload) => {
          // Call specific handlers
          if (payload.eventType === 'INSERT' && config.onInsert) {
            config.onInsert(payload);
          } else if (payload.eventType === 'UPDATE' && config.onUpdate) {
            config.onUpdate(payload);
          } else if (payload.eventType === 'DELETE' && config.onDelete) {
            config.onDelete(payload);
          }

          // Always call onChange if provided
          if (config.onChange) {
            config.onChange(payload);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return cleanup;
  }, [channelName, config.table, config.filter, config.schema, enabled, cleanup]);

  return { cleanup };
}
