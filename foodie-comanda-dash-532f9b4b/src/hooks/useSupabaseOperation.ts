/**
 * Hook para operações Supabase com estados de loading e erro
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  ServiceResult, 
  ServiceError, 
  diagnoseRLSError 
} from '@/lib/supabase-service';

interface UseSupabaseOperationOptions {
  showToastOnError?: boolean;
  showToastOnSuccess?: boolean;
  successMessage?: string;
}

interface OperationState<T> {
  data: T | null;
  error: ServiceError | null;
  isLoading: boolean;
}

export function useSupabaseOperation<T>(
  options: UseSupabaseOperationOptions = {}
) {
  const { 
    showToastOnError = true, 
    showToastOnSuccess = false,
    successMessage = 'Operação realizada com sucesso!'
  } = options;

  const [state, setState] = useState<OperationState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(async (
    operation: () => Promise<ServiceResult<T>>
  ): Promise<ServiceResult<T>> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await operation();

      if (result.success) {
        setState({ data: result.data, error: null, isLoading: false });
        
        if (showToastOnSuccess) {
          toast.success(successMessage);
        }
      } else {
        setState({ data: null, error: result.error, isLoading: false });
        
        if (showToastOnError && result.error) {
          toast.error(diagnoseRLSError(result.error));
        }
      }

      return result;
    } catch (err) {
      const error: ServiceError = {
        code: 'UNEXPECTED',
        message: err instanceof Error ? err.message : 'Erro inesperado',
      };
      
      setState({ data: null, error, isLoading: false });
      
      if (showToastOnError) {
        toast.error(error.message);
      }

      return { data: null, error, success: false };
    }
  }, [showToastOnError, showToastOnSuccess, successMessage]);

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}
