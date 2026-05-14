const puppeteer = require('puppeteer-core');
(async () => {
  try {
    const browser = await puppeteer.launch({ executablePath: '/run/current-system/sw/bin/chromium', headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // Capture in-page errors
    page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));
    page.on('console', msg => console.log('PAGE_LOG:', msg.type(), msg.text()));
    page.on('requestfailed', r => console.log('REQUEST_FAILED:', r.url(), r.failure() && r.failure().errorText));
    page.on('request', r => console.log('REQUEST:', r.method(), r.url()));
    page.on('response', r => console.log('RESPONSE:', r.status(), r.url()));

    // Inject listeners to capture window errors and unhandledrejection inside the page
    await page.evaluateOnNewDocument(() => {
      window.__capturedErrors = [];
      window.addEventListener('error', (e) => { window.__capturedErrors.push({type: 'error', message: e.message, filename: e.filename, lineno: e.lineno}); });
      window.addEventListener('unhandledrejection', (e) => { window.__capturedErrors.push({type: 'unhandledrejection', reason: String(e.reason)}); });
    });

    await page.goto('http://127.0.0.1:5173/war-and-peace-cloud.html', { waitUntil: 'networkidle2', timeout: 60000 });

    // wait a short time for dynamic fetches
    await new Promise((r) => setTimeout(r, 1200));

    // grab app-main content and captured errors
    const result = await page.evaluate(() => {
      const app = document.querySelector('#app-main');
      const text = app ? app.innerText.slice(0, 2000) : 'NO_APP_MAIN';
      const errors = window.__capturedErrors || [];
      // list network requests of interest if available via performance entries
      return { appText: text, errors };
    });

    console.log('APP_MAIN_TEXT:\n', result.appText);
    if (result.errors && result.errors.length) console.log('INPAGE_ERRORS:', JSON.stringify(result.errors, null, 2));

    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('ERR', e && e.message);
    process.exit(2);
  }
})();
