// ===========================================
// CLIENTE SUPABASE - PRODUÇÃO
// Projeto: zlwpxflqtyhdwanmupgy
// ===========================================
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CONFIG } from "@/config/supabase";

// Log de debug para verificar a conexão (remover em produção se necessário)
console.log('[Supabase] Conectando em:', SUPABASE_CONFIG.url);
console.log('[Supabase] Project ID:', SUPABASE_CONFIG.projectId);

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
