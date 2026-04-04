import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const userId = 'b4812e9f-b8de-4caf-bf01-1fb43408d3b6';

(async () => {
  const { data, error } = await supabase
    .from('pedidos_delivery')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar pedidos_delivery:', error);
    process.exit(1);
  }
  console.log('Pedidos encontrados:', data.length);
  if (data.length > 0) {
    console.log('Primeiro pedido:', data[0]);
  }
})();
