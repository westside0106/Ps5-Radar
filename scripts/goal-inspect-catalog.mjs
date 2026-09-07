import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const out = 'data/goal-diagnostics';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const responses = [];
  page.on('response', async response => {
    const url = response.url();
    if (!/playstation\.com|playstation\.net/.test(url) || /analytics|telemetry|consent|tracking/.test(url)) return;
    try { if (/json/.test(response.headers()['content-type'] || '')) responses.push({ url, status: response.status(), body: await response.json() }); } catch {}
  });
  const source = 'https://www.playstation.com/content/dam/global_pdc/en/services/ps-plus/game-finder/js/main.js?v=1014';
  const script = await page.request.get(source);
  await fs.writeFile(`${out}/game-finder.js`, await script.text());
  await page.goto('https://www.playstation.com/de-de/ps-plus/games/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const selector = page.locator('button#select-button-category:visible').first();
  await selector.click();
  await page.locator('button[aria-label="Spielekatalog"]:visible').first().click();
  await page.waitForTimeout(1500);
  await fs.writeFile(`${out}/filtered.html`, await page.content());
  await fs.writeFile(`${out}/filtered.txt`, await page.locator('body').innerText());
  await fs.writeFile(`${out}/responses.json`, JSON.stringify(responses, null, 2));
  console.log('Captured official guest catalog script and filters');
} finally { await browser.close(); }
