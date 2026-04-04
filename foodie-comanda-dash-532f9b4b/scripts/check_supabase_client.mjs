import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zlwpxflqtyhdwanmupgy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsd3B4ZmxxdHloZHdhbm11cGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTQxODcsImV4cCI6MjA4MDM5MDE4N30.XbfIkCWxeSOgJ3tECnuXvaXR2zMfJ2YwIGfItG8gQRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('supabase.postgres exists:', !!supabase.postgres);
if (supabase.postgres) {
  console.log('supabase.postgres.query type:', typeof supabase.postgres.query);
  try {
    const keys = Object.keys(supabase.postgres).slice(0,50);
    console.log('supabase.postgres keys sample:', keys);
  } catch (e) {
    console.log('could not list keys:', String(e));
  }
}

console.log('supabase.rpc available:', typeof supabase.rpc);

(async () => {
  if (supabase.postgres && typeof supabase.postgres.query === 'function') {
    try {
      const res = await supabase.postgres.query({ sql: 'SELECT 1 as ok' });
      console.log('query({ sql }) result keys:', Object.keys(res || {}));
      console.log('res:', res);
    } catch (e) {
      console.log('query({ sql }) failed:', String(e));
    }

    try {
      const res2 = await supabase.postgres.query('SELECT 1 as ok');
      console.log("query('sql') result:", res2);
    } catch (e) {
      console.log("query('sql') failed:", String(e));
    }
  }
})();