/**
 * Serviço centralizado para operações Supabase
 * Fornece métodos tipados com tratamento de erros robusto
 */

import { supabase } from '@/integrations/supabase/client';

// Códigos de erro Supabase comuns
export const SUPABASE_ERROR_CODES = {
  // Autenticação
  INVALID_CREDENTIALS: 'invalid_grant',
  USER_NOT_FOUND: 'user_not_found',
  EMAIL_NOT_CONFIRMED: 'email_not_confirmed',
  
  // RLS
  RLS_VIOLATION: '42501', // insufficient_privilege
  ROW_LEVEL_SECURITY: 'PGRST301',
  
  // Constraints
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  
  // Conexão
  CONNECTION_ERROR: 'PGRST000',
  TIMEOUT: 'PGRST504',
} as const;

// Interface para resultado padronizado
export interface ServiceResult<T> {
  data: T | null;
  error: ServiceError | null;
  success: boolean;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

/**
 * Transforma erro Supabase em ServiceError padronizado
 */
export function parseError(error: unknown): ServiceError {
  if (!error) {
    return { code: 'UNKNOWN', message: 'Erro desconhecido' };
  }

  // Erro do Supabase/PostgreSQL
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    
    return {
      code: (err.code as string) || 'UNKNOWN',
      message: (err.message as string) || 'Erro na operação',
      details: err.details as string | undefined,
      hint: err.hint as string | undefined,
    };
  }

  // Erro genérico
  if (error instanceof Error) {
    return { code: 'JS_ERROR', message: error.message };
  }

  return { code: 'UNKNOWN', message: String(error) };
}

/**
 * Diagnóstico de erro RLS
 */
export function diagnoseRLSError(error: ServiceError): string {
  if (error.code === SUPABASE_ERROR_CODES.RLS_VIOLATION) {
    return `
🔒 Erro de Política de Segurança (RLS):
- Verifique se o usuário está autenticado
- Confirme se existe uma policy para a operação (INSERT/UPDATE/DELETE)
- Verifique se o empresa_id está correto
- Code: ${error.code}
- Detalhes: ${error.details || 'N/A'}
    `.trim();
  }
  
  if (error.code === SUPABASE_ERROR_CODES.UNIQUE_VIOLATION) {
    return `Registro duplicado: ${error.details || 'Já existe um registro com esses dados'}`;
  }
  
  if (error.code === SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
    return `Referência inválida: ${error.details || 'O registro referenciado não existe'}`;
  }
  
  if (error.code === SUPABASE_ERROR_CODES.NOT_NULL_VIOLATION) {
    return `Campo obrigatório: ${error.details || 'Um campo obrigatório está vazio'}`;
  }

  return error.message;
}

/**
 * Verifica status da conexão com Supabase
 */
export async function checkConnection(): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase.from('empresas').select('id').limit(1);
    
    if (error) {
      return {
        data: false,
        error: parseError(error),
        success: false,
      };
    }
    
    return { data: true, error: null, success: true };
  } catch (err) {
    return {
      data: false,
      error: parseError(err),
      success: false,
    };
  }
}

/**
 * Verifica se o usuário atual está autenticado
 */
export async function checkAuth(): Promise<ServiceResult<{ userId: string; empresaId: string | null }>> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        data: null,
        error: { code: 'NOT_AUTHENTICATED', message: 'Usuário não autenticado' },
        success: false,
      };
    }

    // Busca empresa_id do perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return {
        data: null,
        error: parseError(profileError),
        success: false,
      };
    }

    return {
      data: { userId: user.id, empresaId: profile?.empresa_id || null },
      error: null,
      success: true,
    };
  } catch (err) {
    return {
      data: null,
      error: parseError(err),
      success: false,
    };
  }
}

/**
 * Upload de arquivo para Storage
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<ServiceResult<{ path: string; publicUrl: string }>> {
  try {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error(`[Supabase] UPLOAD ${bucket}/${path} error:`, uploadError);
      return {
        data: null,
        error: parseError(uploadError),
        success: false,
      };
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return {
      data: { path, publicUrl },
      error: null,
      success: true,
    };
  } catch (err) {
    console.error(`[Supabase] UPLOAD exception:`, err);
    return {
      data: null,
      error: parseError(err),
      success: false,
    };
  }
}

/**
 * Teste completo de conexão e permissões
 * Use para debug durante desenvolvimento
 */
export async function runDiagnostics(): Promise<{
  connection: boolean;
  auth: boolean;
  userId: string | null;
  empresaId: string | null;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // Teste de conexão
  const connResult = await checkConnection();
  if (!connResult.success) {
    errors.push(`Conexão: ${diagnoseRLSError(connResult.error!)}`);
  }
  
  // Teste de autenticação
  const authResult = await checkAuth();
  if (!authResult.success) {
    errors.push(`Autenticação: ${authResult.error?.message}`);
  }
  
  return {
    connection: connResult.success,
    auth: authResult.success,
    userId: authResult.data?.userId || null,
    empresaId: authResult.data?.empresaId || null,
    errors,
  };
}

/**
 * Wrapper para operações de escrita com tratamento de erro padronizado
 */
export async function safeInsert<T>(
  operation: () => Promise<{ data: T | null; error: unknown }>
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await operation();
    
    if (error) {
      console.error('[Supabase] Insert error:', error);
      return {
        data: null,
        error: parseError(error),
        success: false,
      };
    }
    
    return { data, error: null, success: true };
  } catch (err) {
    console.error('[Supabase] Insert exception:', err);
    return {
      data: null,
      error: parseError(err),
      success: false,
    };
  }
}

/**
 * Wrapper para operações de atualização com tratamento de erro padronizado
 */
export async function safeUpdate<T>(
  operation: () => Promise<{ data: T | null; error: unknown }>
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await operation();
    
    if (error) {
      console.error('[Supabase] Update error:', error);
      return {
        data: null,
        error: parseError(error),
        success: false,
      };
    }
    
    return { data, error: null, success: true };
  } catch (err) {
    console.error('[Supabase] Update exception:', err);
    return {
      data: null,
      error: parseError(err),
      success: false,
    };
  }
}

/**
 * Wrapper para operações de deleção com tratamento de erro padronizado
 */
export async function safeDelete(
  operation: () => Promise<{ error: unknown }>
): Promise<ServiceResult<null>> {
  try {
    const { error } = await operation();
    
    if (error) {
      console.error('[Supabase] Delete error:', error);
      return {
        data: null,
        error: parseError(error),
        success: false,
      };
    }
    
    return { data: null, error: null, success: true };
  } catch (err) {
    console.error('[Supabase] Delete exception:', err);
    return {
      data: null,
      error: parseError(err),
      success: false,
    };
  }
}
