// ===========================================
// CONFIGURAÇÃO FIXA DO SUPABASE - PRODUÇÃO
// NÃO ALTERAR ESTE ARQUIVO
// ===========================================

// Projeto: zlwpxflqtyhdwanmupgy (Food Comanda Pro - Produção)
export const SUPABASE_CONFIG = {
  url: "https://zlwpxflqtyhdwanmupgy.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw",
  projectId: "zlwpxflqtyhdwanmupgy",
} as const;

// Exporta para uso em funções de borda e outros locais
export const SUPABASE_URL = SUPABASE_CONFIG.url;
export const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_CONFIG.url}/functions/v1`;
