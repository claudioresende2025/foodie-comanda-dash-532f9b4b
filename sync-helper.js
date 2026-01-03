#!/usr/bin/env node
/**
 * Script de Ajuda para Sincronização
 * Fornece comandos e links úteis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('\n' + '='.repeat(70));
console.log('🔄 ASSISTENTE DE SINCRONIZAÇÃO DO BANCO DE DADOS');
console.log('='.repeat(70) + '\n');

console.log('📋 ETAPAS DA SINCRONIZAÇÃO:\n');

console.log('1️⃣  ABRIR SQL EDITOR');
console.log('   🔗 https://supabase.com/dashboard/project/zlwpxflqtyhdwanmupgy/sql/new\n');

console.log('2️⃣  ARQUIVO DE MIGRAÇÃO');
const migrationFile = path.join(__dirname, 'supabase', 'migrations', '20260102_complete_sync.sql');
console.log(`   📂 ${migrationFile}\n`);

console.log('3️⃣  INSTRUÇÕES');
console.log('   a) Abra o arquivo acima');
console.log('   b) Copie TODO o conteúdo (Ctrl+A, Ctrl+C)');
console.log('   c) Cole no SQL Editor do Supabase');
console.log('   d) Clique em "Run" ou pressione Ctrl+Enter\n');

console.log('4️⃣  VERIFICAR');
console.log('   Execute: node sync-database.js\n');

console.log('='.repeat(70) + '\n');

// Verificar se o arquivo existe
if (fs.existsSync(migrationFile)) {
  const stats = fs.statSync(migrationFile);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`✅ Arquivo de migração encontrado (${sizeKB} KB)`);
  
  // Contar linhas
  const content = fs.readFileSync(migrationFile, 'utf-8');
  const lines = content.split('\n').length;
  const tables = (content.match(/CREATE TABLE/gi) || []).length;
  
  console.log(`📊 Estatísticas:`);
  console.log(`   - ${lines} linhas de SQL`);
  console.log(`   - ${tables} tabelas serão criadas/verificadas`);
  
  console.log('\n💡 DICA: O arquivo está pronto para ser copiado e colado!\n');
  
  // Oferecer para mostrar o conteúdo
  console.log('🔍 Deseja ver o conteúdo? Execute:');
  console.log(`   cat ${migrationFile}\n`);
  
  console.log('📋 Ou copie direto para o clipboard:');
  console.log(`   cat ${migrationFile} | pbcopy    # Mac`);
  console.log(`   cat ${migrationFile} | xclip     # Linux\n`);
  
} else {
  console.log('❌ Arquivo de migração não encontrado!');
  console.log('   Execute: node sync-database-advanced.js\n');
}

console.log('='.repeat(70));
console.log('📚 DOCUMENTAÇÃO COMPLETA:\n');
console.log('   - Guia Rápido:    SINCRONIZACAO_RAPIDA.md');
console.log('   - Guia Completo:  GUIA_SINCRONIZACAO.md');
console.log('   - Relatório:      database-sync-report.json');
console.log('='.repeat(70) + '\n');

console.log('🎯 COMANDOS ÚTEIS:\n');
console.log('   node sync-database.js              # Verificação rápida');
console.log('   node sync-database-advanced.js     # Verificação detalhada');
console.log('   node sync-helper.js                # Este arquivo\n');

console.log('✨ Boa sorte com a sincronização!\n');
