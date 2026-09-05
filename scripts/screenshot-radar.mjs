import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.RADAR_SCREENSHOT_URL || 'http://127.0.0.1:3000';
const password = process.env.RADAR_SCREENSHOT_PASSWORD || 'radar-local';
const radar = JSON.parse(await fs.readFile(new URL('../data/radar.json', import.meta.url), 'utf8'));
const match = String(radar.edition || '').match(/#(\d+)/);
const id = String(match ? Number(match[1]) : 1).padStart(3, '0');
const outDir = path.resolve('data/daily');
const latest = path.join(outDir, 'latest.png');
const numbered = path.join(outDir, `${id}.png`);

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL('**/radar'),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForLoadState('networkidle');
  await page.locator('.magazine').waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(imgs.map(img => img.complete ? null : new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 4000);
    })));
  });
  await page.locator('.magazine').screenshot({ path: latest, type: 'png' });
  try {
    await fs.access(numbered);
  } catch {
    await fs.copyFile(latest, numbered);
  }
  console.log(`Rendered Radar ${radar.edition} -> data/daily/latest.png and ${id}.png`);
} finally {
  await browser.close();
}
