import { test, expect } from '@playwright/test';

// Configure via env vars or replace these defaults with real IDs
const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const EMPRESA_ID = process.env.TEST_EMPRESA_ID || 'REPLACE_EMPRESA_ID';
const MESA_ID = process.env.TEST_MESA_ID || 'REPLACE_MESA_ID';

test.describe('Menu page mesa status', () => {
  test('marca mesa como ocupada ao abrir o cardápio', async ({ page }) => {
    if (EMPRESA_ID === 'REPLACE_EMPRESA_ID' || MESA_ID === 'REPLACE_MESA_ID') {
      test.skip(true, 'Defina TEST_EMPRESA_ID e TEST_MESA_ID como variáveis de ambiente');
    }

    // Aguarda a requisição que atualiza a mesa para 'ocupada'
    const waitForMesaUpdate = page.waitForRequest((req) => {
      const url = req.url();
      const isMesasRest = url.includes('/rest/v1/mesas') || url.includes('/rpc') || url.match(/mesas/);
      if (!isMesasRest) return false;
      try {
        const post = req.postData();
        if (post && post.includes('ocupada')) return true;
      } catch (e) {
        // ignore
      }
      // also accept PATCH requests to mesas
      return req.method() === 'PATCH' && isMesasRest;
    }, { timeout: 15000 });

    await page.goto(`${BASE}/menu/${EMPRESA_ID}/${MESA_ID}`, { waitUntil: 'networkidle' });

    const req = await waitForMesaUpdate;
    const payload = req.postData() || '';

    expect(payload).toContain('ocupada');

    // sucesso: log simples
    console.log('Intercepted request to mesas with payload:', payload.substring(0, 1000));
  });
});
