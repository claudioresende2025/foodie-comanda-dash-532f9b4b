// Este arquivo é para criar e exportar a instância do cliente Supabase.
// IMPORTANTE: Credenciais HARDCODED do projeto Supabase EXTERNO (zlwpxflqtyhdwanmupgy)
// Isso evita que o Lovable Cloud sobrescreva as configurações ao regenerar o .env

import { createClient } from "@supabase/supabase-js";

// Credenciais FIXAS do projeto Supabase externo - NÃO usar .env
// O Lovable Cloud regenera o .env automaticamente, sobrescrevendo com credenciais internas
const SUPABASE_URL = "https://zlwpxflqtyhdwanmupgy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw";

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
