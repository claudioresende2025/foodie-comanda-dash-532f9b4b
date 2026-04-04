const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:4174';
  const EMPRESA_ID = process.env.TEST_EMPRESA_ID || 'REPLACE_EMPRESA_ID';
  const MESA_ID = process.env.TEST_MESA_ID || 'REPLACE_MESA_ID';

  if (EMPRESA_ID === 'REPLACE_EMPRESA_ID' || MESA_ID === 'REPLACE_MESA_ID') {
    console.log('Skipping test: set TEST_EMPRESA_ID and TEST_MESA_ID environment variables');
    process.exit(0);
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    const waitForMesaUpdate = page.waitForRequest((req) => {
      const url = req.url();
      const isMesas = url.includes('/rest/v1/mesas') || url.includes('/rpc') || /mesas/.test(url);
      if (!isMesas) return false;
      try {
        const post = req.postData();
        if (post && post.includes('ocupada')) return true;
      } catch (e) {}
      return req.method() === 'PATCH' && isMesas;
    }, { timeout: 15000 });

    console.log('Navigating to', `${BASE}/menu/${EMPRESA_ID}/${MESA_ID}`);
    await page.goto(`${BASE}/menu/${EMPRESA_ID}/${MESA_ID}`, { waitUntil: 'networkidle' });

    const req = await waitForMesaUpdate;
    const payload = req.postData() || '';
    console.log('Intercepted request to mesas; payload snippet:', payload.substring(0, 1000));
    console.log('Test passed: mesa update to ocupada observed');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed or timed out:', err && err.message ? err.message : err);
    await browser.close();
    process.exit(2);
  }
})();
