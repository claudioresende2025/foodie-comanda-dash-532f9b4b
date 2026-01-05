import { supabase } from '@/lib/supabase-service';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { mesaId, empresaId } = req.body;
  if (!mesaId || !empresaId) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
  }

  const { error } = await supabase
    .from('mesas')
    .update({ status: 'ocupada' })
    .eq('id', mesaId)
    .eq('empresa_id', empresaId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
