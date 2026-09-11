import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { CATALOG_SOURCE, CATALOG_CATEGORIES, emptyCatalog, normalizeCatalog, mergeCatalogSnapshots, storeIdentity, verifiedImage } from '../lib/ps-plus-catalog.mjs';
const output = new URL('../data/ps-plus-catalog.json', import.meta.url);
const previous = await fs.readFile(output,'utf8').then(JSON.parse).catch(() => emptyCatalog());
const raw = { checkedAt:new Date().toISOString(), sourceUrl:CATALOG_SOURCE, results:{}, errors:[] };
const browser = await chromium.launch({headless:true});
const cardSelector = '.plus-results a[class*="card_link"]';
const countSelector = '.plus-results [class*="pagination_count"]';
function countFromText(value) { const match=String(value).match(/(\d[\d.,]*)\s+Spiele/i); return match ? Number(match[1].replace(/\D/g,'')) : null; }
async function capture(page, service, label) {
  await page.locator('#select-button-category:visible').first().click();
  await page.getByRole('button',{name:label,exact:true}).last().click();
  await page.locator(cardSelector).first().waitFor({timeout:20000});
  const expected = countFromText(await page.locator(countSelector).innerText());
  if (!Number.isInteger(expected)) throw new Error(`${service}: Anzahl nicht lesbar`);
  const entries = new Map();
  const maxPages = Math.max(1,Math.ceil(expected/10)+5);
  for (let index=0;index<maxPages;index++) {
    const batch = await page.locator(cardSelector).evaluateAll(nodes => nodes.map(a => {
      const art=a.querySelector('[aria-label^="Artwork"], [class*="card_image-holder"]');
      const image=art?.style.backgroundImage?.match(/url\(["']?([^"')]+)/)?.[1] || art?.querySelector('img')?.src || null;
      const title=a.querySelector('[class*="card_name"]')?.textContent?.trim() || a.textContent.trim();
      const tags=a.querySelector('[class*="card_tags"]')?.textContent || '';
      return {title,storeUrl:a.href,image,platforms:[...new Set(tags.match(/\bPS[45]\b/g)||[])]};
    }));
    for (const item of batch) {
      const id=storeIdentity(item.storeUrl);
      if (!id || !item.title) throw new Error(`${service}: Ungültiger Produkteintrag`);
      item.image=verifiedImage(item.image);
      entries.set(id,item);
    }
    const next=page.locator('.plus-results [aria-label="Next page"]').first();
    if (!await next.count() || await next.getAttribute('aria-disabled')==='true') break;
    const current=await page.locator('.plus-results [aria-current="page"]').innerText();
    await next.click();
    await page.waitForFunction(previous => document.querySelector('.plus-results [aria-current="page"]')?.textContent?.trim() !== previous,current,{timeout:15000});
  }
  return {expected,complete:entries.size===expected,entries:[...entries.values()]};
}
try {
  const page=await browser.newPage({viewport:{width:1280,height:900},locale:'de-DE',timezoneId:'Europe/Berlin'});
  await page.goto(CATALOG_SOURCE,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator(cardSelector).first().waitFor({timeout:60000});
  for (const [service,label] of Object.entries(CATALOG_CATEGORIES)) {
    try { raw.results[service]=await capture(page,service,label); }
    catch(error) {raw.errors.push(`${service}: ${error.message}`);raw.results[service]={expected:null,complete:false,entries:[]};}
  }
} catch(error) {raw.errors.push(`Quelle: ${error.message}`);}
finally {await browser.close();}
const candidate=normalizeCatalog(raw);
const snapshot=mergeCatalogSnapshots(previous,candidate);
await fs.writeFile(output,JSON.stringify(snapshot,null,2)+'\n');
console.log('PS+ catalog:',Object.entries(snapshot.sections).map(([k,v])=>`${k} ${v.count}/${v.expected??'?'}${v.complete?' ✓':''}`).join(', '));
if (raw.errors.length) console.warn(raw.errors.join('\n'));
// The independent catalog refresh never fabricates results or changes the Daily Radar.
