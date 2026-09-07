import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const out = 'data/goal-diagnostics';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const responses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (!/playstation\.com|playstation\.net/.test(url) || !/graphql|catalog|ps-plus|game-finder|gamefinder/i.test(url)) return;
    try {
      if (/json/.test(response.headers()['content-type'] || '')) responses.push({ url, status: response.status(), body: await response.json() });
    } catch {}
  });
  await page.goto('https://www.playstation.com/de-de/ps-plus/games/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  await fs.writeFile(`${out}/page.html`, await page.content());
  await fs.writeFile(`${out}/links.json`, JSON.stringify(await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => ({ text: n.innerText, href: n.href, className: n.className }))), null, 2));
  await fs.writeFile(`${out}/responses.json`, JSON.stringify(responses, null, 2));
  await fs.writeFile(`${out}/text.txt`, await page.locator('body').innerText());
  await page.screenshot({ path: `${out}/page.png`, fullPage: true });
  console.log('Catalog diagnostic captured', responses.length, 'JSON responses');
} finally { await browser.close(); }
