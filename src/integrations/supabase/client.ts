// Este arquivo é para criar e exportar a instância do cliente Supabase.

import { createClient } from "@supabase/supabase-js";

// As variáveis VITE_ são lidas automaticamente se você estiver usando frameworks como Vite, Next.js, etc.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// 1. Verifica se as chaves foram carregadas (boa prática de segurança)
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "As variáveis de ambiente SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY devem estar definidas no arquivo .env",
  );
}

// 2. Cria o cliente Supabase
// Criamos o cliente sem o genérico `Database` para evitar erros de "instanciação de tipo muito profunda"
// Remova esse comentário se preferir tipar o cliente novamente após gerar tipos mais leves.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Define o armazenamento local para persistir a sessão do usuário
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Exemplo de como importar em outro arquivo:
// import { supabase } from "@/integrations/supabase/client";
