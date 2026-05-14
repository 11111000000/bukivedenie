const puppeteer = require('puppeteer-core');
(async () => {
  try {
    const browser = await puppeteer.launch({ executablePath: '/run/current-system/sw/bin/chromium', headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE_LOG:', msg.text()));
    page.on('requestfailed', r => console.log('REQUEST_FAILED:', r.url(), r.failure() && r.failure().errorText));
    page.on('request', r => console.log('REQUEST:', r.method(), r.url()));
    page.on('response', r => console.log('RESPONSE:', r.status(), r.url()));
    await page.goto('http://127.0.0.1:5173/war-and-peace-cloud.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(1000);
    const content = await page.evaluate(() => {
      const panel = document.querySelector('#app-main');
      return panel ? panel.innerHTML.slice(0, 2000) : 'NO_APP_MAIN';
    });
    console.log('APP_MAIN_HEAD:\n', content);
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('ERR', e && e.message);
    process.exit(2);
  }
})();
