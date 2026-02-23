// Este arquivo é para criar e exportar a instância do cliente Supabase.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://jejpufnzaineihemdrgd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplanB1Zm56YWluZWloZW1kcmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODgxMDAsImV4cCI6MjA4MDM2NDEwMH0.b0sXHLsReI8DOSN-IKz1PxSF9pQ3zjkkK1PKsCQkHMg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
