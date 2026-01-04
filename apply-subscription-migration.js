// Script para aplicar migration de assinatura no Supabase
// Execute com: node apply-subscription-migration.js

const fs = require('fs');
const https = require('https');
const path = require('path');

// Lê as variáveis de ambiente ou usa valores do .env
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.log('\n⚠️  SUPABASE_SERVICE_ROLE_KEY não encontrada.');
  console.log('\n📋 INSTRUÇÕES PARA APLICAR A MIGRATION:');
  console.log('═'.repeat(60));
  console.log('\n1. Acesse o Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy');
  console.log('\n2. Vá em "SQL Editor" no menu lateral');
  console.log('\n3. Copie o conteúdo do arquivo:');
  console.log('   supabase/migrations/20260105_subscription_system.sql');
  console.log('\n4. Cole no editor SQL e clique "Run"');
  console.log('\n═'.repeat(60));
  process.exit(0);
}

async function applyMigration() {
  const migrationPath = path.join(__dirname, 'supabase/migrations/20260105_subscription_system.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({ sql_query: sql })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  console.log('✅ Migration aplicada com sucesso!');
}

applyMigration().catch(console.error);
