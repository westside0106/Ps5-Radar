import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { CATALOG_SOURCE, CATALOG_CATEGORIES, emptyCatalog, normalizeCatalog, mergeCatalogSnapshots, storeIdentity, verifiedImage } from '../lib/ps-plus-catalog.mjs';
const output = new URL('../data/ps-plus-catalog.json', import.meta.url);
const previous = await fs.readFile(output,'utf8').then(JSON.parse).catch(() => emptyCatalog());
const raw = { checkedAt:new Date().toISOString(), sourceUrl:CATALOG_SOURCE, results:{}, errors:[] };
const browser = await chromium.launch({headless:true});
const cardSelector = '.plus-results a[class*="card_link"]';
const countSelector = '.plus-results [class*="pagination_count"]';
// Die Seite rendert Filterleiste und Zaehler doppelt (Desktop- und Mobilvariante).
async function dismissConsent(page) {
  await page.locator('#onetrust-reject-all-handler').first().waitFor({state:'visible',timeout:20000}).catch(()=>{});
  for (const id of ['#onetrust-reject-all-handler','#onetrust-accept-btn-handler']) {
    const button=page.locator(id).first();
    if (await button.isVisible().catch(()=>false)) { await button.click({timeout:10000}).catch(()=>{}); break; }
  }
  await page.locator('.onetrust-pc-dark-filter').waitFor({state:'hidden',timeout:20000}).catch(()=>{});
}
function countFromText(value) { const match=String(value).match(/(\d[\d.,]*)\s+Spiele/i); return match ? Number(match[1].replace(/\D/g,'')) : null; }
async function selectCategory(page, label) {
  const buttons = page.locator('#select-button-category');
  for (let index = 0; index < await buttons.count(); index++) {
    const button = buttons.nth(index);
    if (!await button.isVisible().catch(() => false)) continue;
    try {
      await button.scrollIntoViewIfNeeded({timeout:5000});
      await button.click({timeout:8000});
      const option = page.getByRole('button',{name:label,exact:true}).last();
      await option.waitFor({state:'visible',timeout:8000});
      await option.click({timeout:8000});
      return;
    } catch { await page.keyboard.press('Escape').catch(() => {}); }
  }
  throw new Error(`Kategorie "${label}" nicht waehlbar`);
}
async function stableCount(page) {
  // Nach einem Kategoriewechsel rendert die Seite asynchron neu; ein zu frueh
  // gelesener Zaehler gehoert noch zur vorherigen Kategorie.
  let previous = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const value = countFromText(await page.locator(countSelector).first().innerText().catch(() => ''));
    if (Number.isInteger(value) && value === previous) return value;
    previous = value;
    await page.waitForTimeout(500);
  }
  return previous;
}
async function assertSingleCategory(page, label) {
  // Der Spieltyp-Filter ist ein Mehrfachfilter: ohne sauberen Ausgangszustand
  // summieren sich die Kategorien und der Zaehler gilt fuer die Vereinigung.
  const text = (await page.locator('#select-button-category').first().innerText()).replace(/\s+/g,' ').trim();
  const selected = text.replace(/^Spieltyp\s*/i,'').trim();
  if (selected !== label) throw new Error(`Filter steht auf "${selected}" statt exakt auf "${label}"`);
}
async function capture(page, service, label) {
  await selectCategory(page, label);
  await assertSingleCategory(page, label);
  await page.locator(cardSelector).first().waitFor({timeout:20000});
  await page.waitForLoadState('networkidle').catch(() => {});
  const expected = await stableCount(page);
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
    await page.waitForFunction(previous => document.querySelector('.plus-results [aria-current="page"]')?.textContent?.trim() !== previous,current,{timeout:30000});
    await page.locator(cardSelector).first().waitFor({timeout:20000});
  }
  return {expected,complete:entries.size===expected,entries:[...entries.values()]};
}
try {
  const page=await browser.newPage({viewport:{width:1280,height:900},locale:'de-DE',timezoneId:'Europe/Berlin'});
  for (const [service,label] of Object.entries(CATALOG_CATEGORIES)) {
    try {
      await page.goto(CATALOG_SOURCE,{waitUntil:'domcontentloaded',timeout:60000});
      await dismissConsent(page);
      await page.locator(cardSelector).first().waitFor({timeout:60000});
      raw.results[service]=await capture(page,service,label);
    }
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
