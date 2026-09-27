import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.RADAR_SCREENSHOT_URL || 'http://127.0.0.1:3000';
const password = process.env.RADAR_PASSWORD || 'radar-local';
const secret = process.env.RADAR_SESSION_SECRET || 'radar-local-screenshot-secret';
const radar = JSON.parse(await fs.readFile(new URL('../data/radar.json', import.meta.url), 'utf8'));
const match = String(radar.edition || '').match(/#(\d+)/);
const id = String(match ? Number(match[1]) : 1).padStart(3, '0');
const outDir = path.resolve('data/daily');
const latest = path.join(outDir, 'latest.png');
const numbered = path.join(outDir, `${id}.png`);
const token = crypto.createHmac('sha256', secret).update(`psradar:${password}`).digest('hex');
const host = new URL(baseUrl).hostname;

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1100 },
    deviceScaleFactor: 1,
  });
  await context.addCookies([{ name: 'psradar_session', value: token, domain: host, path: '/', httpOnly: true, sameSite: 'Lax', secure: false }]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/radar`, { waitUntil: 'domcontentloaded' });
  await page.locator('.magazine').waitFor({ state: 'visible', timeout: 20000 });
  await page.addStyleTag({ content: `
    .watchlist-dock,
    nextjs-portal,
    [data-next-badge-root],
    [data-nextjs-toast],
    #nextjs__container_errors { display: none !important; visibility: hidden !important; }
  ` });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(2500);
  await page.locator('.magazine').screenshot({ path: latest, type: 'png' });
  await fs.copyFile(latest, numbered);
  console.log(`Rendered Radar ${radar.edition} -> data/daily/latest.png and ${id}.png`);
} finally {
  await browser.close();
}
