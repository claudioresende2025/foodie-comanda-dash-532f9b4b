import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const emails = ['claudinhoresendemoura@gmail.com', 'usercontratada@gmail.com'];

(async () => {
  for (const email of emails) {
    // Buscar o id do usuário pelo e-mail
    const { data: profiles, error: errProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', email)
      .limit(1);
    if (errProfile) {
      console.error(`Erro ao buscar profile para ${email}:`, errProfile);
      continue;
    }
    if (!profiles || profiles.length === 0) {
      console.log(`Nenhum profile encontrado para ${email}`);
      continue;
    }
    const userId = profiles[0].id;
    const { data: pedidos, error: errPedidos } = await supabase
      .from('pedidos_delivery')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (errPedidos) {
      console.error(`Erro ao buscar pedidos para ${email}:`, errPedidos);
      continue;
    }
    console.log(`Pedidos para ${email} (user_id: ${userId}):`, pedidos.length);
    if (pedidos.length > 0) {
      console.log('Primeiro pedido:', pedidos[0]);
    }
  }
})();
