/**
 * Script para aplicar SQL diretamente via fetch na API do Supabase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

async function fixRelationship() {
  console.log('🔧 Aplicando correção do relacionamento...\n');

  // SQL simplificado que recria apenas o constraint
  const sql = `
-- Remover constraint antiga se existir
ALTER TABLE IF EXISTS public.itens_delivery 
  DROP CONSTRAINT IF EXISTS itens_delivery_pedido_delivery_id_fkey;

-- Adicionar constraint com nome explícito
ALTER TABLE public.itens_delivery 
  ADD CONSTRAINT itens_delivery_pedido_delivery_id_fkey 
  FOREIGN KEY (pedido_delivery_id) 
  REFERENCES public.pedidos_delivery(id) 
  ON DELETE CASCADE;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_itens_delivery_pedido_id 
  ON public.itens_delivery(pedido_delivery_id);
`;

  console.log('📝 SQL a ser executado:');
  console.log(sql);
  console.log('\n⚠️  IMPORTANTE: Este script requer permissões de administrador.\n');
  console.log('📋 Para aplicar manualmente:');
  console.log('1. Acesse: https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/sql/new');
  console.log('2. Cole o SQL acima');
  console.log('3. Clique em "Run"');
  console.log('4. Aguarde 1-2 minutos');
  console.log('5. Teste a aplicação\n');

  // Salvar em arquivo
  const fixPath = path.join(__dirname, 'fix-relationship.sql');
  fs.writeFileSync(fixPath, sql);
  console.log('✅ SQL salvo em:', fixPath);
  console.log('\n🌐 Link direto para o SQL Editor:');
  console.log('https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/sql/new\n');
}

fixRelationship();
