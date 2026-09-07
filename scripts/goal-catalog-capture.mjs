import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const out = 'data/goal-diagnostics';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const categories = [['extra','Spielekatalog'],['classics','Klassikerkatalog'],['ubisoft','Ubisoft+ Classics'],['essential','Monatliche Spiele']];
const results = {};
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await page.goto('https://www.playstation.com/de-de/ps-plus/games/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.plus-results .card_link').first().waitFor({ timeout: 60000 });
  for (const [service,label] of categories) {
    await page.locator('button#select-button-category:visible').first().click();
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.waitForTimeout(700);
    const entries = new Map();
    let expected = 0;
    for (let n = 0; n < 100; n++) {
      const batch = await page.locator('.plus-results .card_link').evaluateAll(nodes => nodes.map(a => {
        const art = a.querySelector('[aria-label^="Artwork"], [class*="card_image-holder"]');
        const image = art?.style.backgroundImage?.match(/url\(["']?([^"')]+)/)?.[1] || null;
        const title = a.querySelector('[class*="card_name"]')?.textContent?.trim() || a.textContent.trim();
        const platformText = a.querySelector('[class*="card_tags"]')?.textContent || '';
        const platforms = [...new Set([...(platformText.match(/PS[45]/g) || []), ...(title.match(/PS[45]/g) || [])])];
        return { title, storeUrl: a.href, image, platforms };
      }));
      for (const item of batch) entries.set(item.storeUrl, item);
      const count = await page.locator('.plus-results [class*="pagination_count"]').innerText().catch(() => '');
      expected = Number(count.replace(/[^0-9]/g,'')) || expected;
      const next = page.locator('.plus-results [aria-label="Next page"]');
      if (!await next.count() || await next.getAttribute('aria-disabled') === 'true') break;
      const before = await page.locator('.plus-results [aria-current="page"]').innerText().catch(() => '');
      await next.click();
      await page.waitForFunction(previous => document.querySelector('.plus-results [aria-current="page"]')?.textContent?.trim() !== previous, before, { timeout: 15000 });
    }
    results[service] = { expected, entries: [...entries.values()] };
    if (expected && entries.size < expected) errors.push(`${service}: ${entries.size}/${expected}`);
    console.log(`${service}: ${entries.size}/${expected}`);
  }
  await fs.writeFile(`${out}/catalog-raw.json`, JSON.stringify({ checkedAt: new Date().toISOString(), sourceUrl: 'https://www.playstation.com/de-de/ps-plus/games/', results, errors }, null, 2));
} catch (error) {
  errors.push(error.stack || String(error));
  await fs.writeFile(`${out}/catalog-error.txt`, errors.join('\n'));
  throw error;
} finally { await browser.close(); }
