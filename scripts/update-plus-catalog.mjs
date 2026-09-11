import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { CATALOG_SOURCE, CATALOG_CATEGORIES, CATALOG_GENRES, CATALOG_PLATFORMS, emptyCatalog, normalizeCatalog, mergeCatalogSnapshots, storeIdentity, verifiedImage } from '../lib/ps-plus-catalog.mjs';
const output = new URL('../data/ps-plus-catalog.json', import.meta.url);
const previous = await fs.readFile(output,'utf8').then(JSON.parse).catch(() => emptyCatalog());
const raw = { checkedAt:new Date().toISOString(), sourceUrl:CATALOG_SOURCE, results:{}, errors:[] };
const tags = { genres:{}, platforms:{} };
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
async function selectOption(page, field, label) {
  const buttons = page.locator(`#select-button-${field}`);
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
  throw new Error(`Option "${label}" in ${field} nicht waehlbar`);
}
async function readCount(page) {
  const counter = page.locator(countSelector).first();
  await counter.waitFor({state:'visible',timeout:20000}).catch(() => {});
  return countFromText(await counter.innerText().catch(() => ''));
}
async function stableReading(page) {
  let previous = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const value = await readCount(page);
    if (Number.isInteger(value) && value === previous) return value;
    previous = value;
    await page.waitForTimeout(500);
  }
  return null;
}
async function filteredCount(page, total) {
  // Der Zaehler haengt dem Filterwechsel nach und laeuft dabei ueber die
  // ungefilterte Gesamtzahl. Ein Wert gilt daher erst als Kategoriezahl, wenn
  // er stabil ist UND sich von der Gesamtzahl unterscheidet.
  for (let attempt = 0; attempt < 12; attempt++) {
    const value = await stableReading(page);
    if (Number.isInteger(value) && value !== total) return value;
    await page.waitForTimeout(500);
  }
  return null;
}
async function currentSelection(page, field, prefix) {
  const text = (await page.locator(`#select-button-${field}`).first().innerText()).replace(/\s+/g,' ').trim();
  return text.replace(new RegExp(`^${prefix}\\s*`,'i'),'').trim();
}
async function ensureFirstPage(page) {
  // Nach der Paginierung einer grossen Kategorie bleibt die Seitenposition
  // stehen; die naechste Kategorie startet sonst nicht auf Seite 1.
  const current = page.locator('.plus-results [aria-current="page"]').first();
  if (!await current.count()) return;
  if ((await current.innerText().catch(() => '')).trim() === '1') return;
  const first = page.locator('.plus-results [class*="pagination"] a').filter({hasText:/^1$/}).first();
  if (!await first.count()) return;
  const before = await page.locator(cardSelector).first().getAttribute('href').catch(() => null);
  await first.scrollIntoViewIfNeeded({timeout:5000}).catch(() => {});
  await first.click({timeout:10000}).catch(() => {});
  await page.waitForFunction(([selector,previous]) => {
    const card = document.querySelector(selector);
    return Boolean(card) && card.getAttribute('href') !== previous;
  },[cardSelector,before],{timeout:20000}).catch(() => {});
}
async function resetField(page, field, prefix) {
  // Anders als der Spieltyp-Filter schalten Genre und Plattform bei erneutem
  // Klick nicht ab; sie brauchen die neutrale Option.
  if (await currentSelection(page, field, prefix) === 'Beliebig') return;
  await selectOption(page, field, 'Beliebig');
  const rest = await currentSelection(page, field, prefix);
  if (rest !== 'Beliebig') throw new Error(`bleibt auf "${rest}"`);
}
async function capture(page, service, label, total, field = 'category', prefix = 'Spieltyp') {
  // Der Filter ist ein Mehrfachfilter: ohne sauberen Ausgangszustand summieren
  // sich die Auswahlen und der Zaehler gilt fuer die Vereinigung.
  await selectOption(page, field, label);
  const selected = await currentSelection(page, field, prefix);
  if (selected !== label) throw new Error(`Filter steht auf "${selected}" statt exakt auf "${label}"`);
  await page.locator(cardSelector).first().waitFor({timeout:20000});
  await ensureFirstPage(page);
  const expected = await filteredCount(page, total);
  if (!Number.isInteger(expected)) throw new Error(`${service}: Anzahl nicht von der Gesamtzahl unterscheidbar`);
  const entries = new Map();
  let seen = 0;
  const maxPages = Math.max(1,Math.ceil(expected/10)+5);
  for (let index=0;index<maxPages;index++) {
    const batch = await page.locator(cardSelector).evaluateAll(nodes => nodes.map(a => {
      const art=a.querySelector('[aria-label^="Artwork"], [class*="card_image-holder"]');
      const image=art?.style.backgroundImage?.match(/url\(["']?([^"')]+)/)?.[1] || art?.querySelector('img')?.src || null;
      const title=a.querySelector('[class*="card_name"]')?.textContent?.trim() || a.textContent.trim();
      const tags=a.querySelector('[class*="card_tags"]')?.textContent || '';
      return {title,storeUrl:a.href,image,platforms:[...new Set(tags.match(/\bPS[45]\b/g)||[])]};
    }));
    seen += batch.length;
    for (const item of batch) {
      const id=storeIdentity(item.storeUrl);
      if (!id || !item.title) throw new Error(`${service}: Ungültiger Produkteintrag`);
      item.image=verifiedImage(item.image);
      entries.set(id,item);
    }
    const next=page.locator('.plus-results [aria-label="Next page"]').first();
    if (!await next.count() || await next.getAttribute('aria-disabled')==='true') break;
    // Der Seitenindikator ist wie der Zaehler doppelt im DOM; das erste Cover
    // der Liste ist das verlaesslichere Signal fuer einen Seitenwechsel.
    const current=await page.locator(cardSelector).first().getAttribute('href').catch(()=>null);
    await next.scrollIntoViewIfNeeded({timeout:5000}).catch(()=>{});
    await next.click({timeout:10000}).catch(()=>{});
    try {
      await page.waitForFunction(([selector,previous]) => {
        const first=document.querySelector(selector);
        return Boolean(first) && first.getAttribute('href') !== previous;
      },[cardSelector,current],{timeout:20000});
    } catch { break; }
    await page.locator(cardSelector).first().waitFor({timeout:20000});
  }
  const confirmed = await stableReading(page);
  if (Number.isInteger(confirmed) && confirmed !== expected) {
    throw new Error(`Anzahl wechselte waehrend der Erfassung von ${expected} auf ${confirmed}`);
  }
  if (entries.size !== expected) {
    console.warn(`${service}: ${entries.size}/${expected} eindeutig, ${seen} Karten gesehen, ${seen-entries.size} doppelt`);
  }
  return {expected,observed:seen,complete:seen===expected,entries:[...entries.values()]};
}
try {
  const page=await browser.newPage({viewport:{width:1280,height:900},locale:'de-DE',timezoneId:'Europe/Berlin'});
  await page.goto(CATALOG_SOURCE,{waitUntil:'domcontentloaded',timeout:60000});
  await dismissConsent(page);
  await page.locator(cardSelector).first().waitFor({timeout:60000});
  const total = await stableReading(page);
  if (!Number.isInteger(total)) throw new Error('Gesamtzahl der Spiele nicht lesbar');
  for (const [service,label] of Object.entries(CATALOG_CATEGORIES)) {
    try { raw.results[service]=await capture(page,service,label,total); }
    catch(error) {raw.errors.push(`${service}: ${error.message}`);raw.results[service]={expected:null,complete:false,entries:[]};}
    // Auswahl wieder loesen, sonst addiert der naechste Klick eine Kategorie dazu.
    try {
      if (await currentSelection(page, 'category', 'Spieltyp') !== 'Beliebig') await selectOption(page, 'category', label);
      const rest = await currentSelection(page, 'category', 'Spieltyp');
      if (rest !== 'Beliebig') throw new Error(`Filter bleibt auf "${rest}" haengen`);
    } catch(error) { raw.errors.push(`${service}: Zuruecksetzen fehlgeschlagen - ${error.message}`); break; }
  }

  // Genre und Plattform als eigene Durchlaeufe. Uebernommen wird nur, was der
  // Zaehler der Quelle bestaetigt; eine unvollstaendige Runde taggt nichts.
  for (const [field, prefix, options, key] of [
    ['genre', 'Genre', CATALOG_GENRES, 'genres'],
    ['device', 'Spielbar auf', CATALOG_PLATFORMS, 'platforms'],
  ]) {
    for (const label of options) {
      // Ein Zaehlerwechsel waehrend der Erfassung ist meist Nachladen der
      // Quelle, kein Datenfehler - ein zweiter Anlauf genuegt.
      let round = null, last = null;
      for (let attempt = 0; attempt < 2 && !round; attempt++) {
        try { round = await capture(page, `${key}:${label}`, label, total, field, prefix); }
        catch(error) { last = error; await resetField(page, field, prefix).catch(() => {}); }
      }
      if (!round) raw.errors.push(`${key} ${label}: ${last?.message}`);
      else if (!round.complete) raw.errors.push(`${key} ${label}: ${round.observed}/${round.expected} Karten, nicht uebernommen`);
      else for (const item of round.entries) {
        const id = storeIdentity(item.storeUrl);
        if (id) (tags[key][id] ||= new Set()).add(label);
      }
      try { await resetField(page, field, prefix); }
      catch(error) { raw.errors.push(`${key} ${label}: Zuruecksetzen fehlgeschlagen - ${error.message}`); break; }
    }
  }

  // Tags auf die erfassten Eintraege legen.
  for (const section of Object.values(raw.results)) {
    for (const item of section.entries || []) {
      const id = storeIdentity(item.storeUrl);
      if (!id) continue;
      if (tags.genres[id]) item.genres = [...tags.genres[id]].sort((a,b)=>a.localeCompare(b,'de'));
      if (tags.platforms[id]) item.platforms = [...tags.platforms[id]].sort();
    }
  }
} catch(error) {raw.errors.push(`Quelle: ${error.message}`);}
finally {await browser.close();}
const candidate=normalizeCatalog(raw);
const snapshot=mergeCatalogSnapshots(previous,candidate);
await fs.writeFile(output,JSON.stringify(snapshot,null,2)+'\n');
console.log('PS+ catalog:',Object.entries(snapshot.sections).map(([k,v])=>`${k} ${v.count}/${v.expected??'?'}${v.complete?' ✓':''}`).join(', '));
if (raw.errors.length) console.warn(raw.errors.join('\n'));
// The independent catalog refresh never fabricates results or changes the Daily Radar.
