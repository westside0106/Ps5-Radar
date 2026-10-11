import { chromium } from 'playwright';
import { productKey } from '../../platform-core/model.mjs';

// Offizielle Katalogansicht. Der PlayWith-Parameter legt die Zielplattform
// ausdruecklich fest; ohne ihn mischt die Seite drei Ziele per ODER und die
// targets eines Produkts waeren nicht belegbar.
export const XBOX_TARGET = 'xbox-series';
export const XBOX_CATALOG = 'https://www.xbox.com/de-DE/games/all-games/console?PlayWith=XboxSeriesX%7CS';

// Jede Sicht ist eine Filteroption der offiziellen Seite. Game Pass wird nach
// Tier getrennt gefuehrt; EA Play und Ubisoft+ sind eigene Dienste, kein
// pauschales "enthalten".
export const XBOX_VIEWS = {
  deals:              { group: 'Preise',      option: 'Im Angebot' },
  'gamepass-console': { group: 'Abonnements', option: 'Game Pass für Konsole', serviceId: 'xbox-game-pass', tierId: 'console' },
  'gamepass-ultimate':{ group: 'Abonnements', option: 'Game Pass Ultimate',    serviceId: 'xbox-game-pass', tierId: 'ultimate' },
  'ea-play':          { group: 'Abonnements', option: 'EA Play',               serviceId: 'ea-play',        tierId: 'ea-play' },
  'ubisoft-plus':     { group: 'Abonnements', option: 'Ubisoft+',              serviceId: 'ubisoft-plus',   tierId: 'ubisoft-plus' },
};

// An die Kartenstruktur gebunden, nicht an den Link: die Kopfleiste enthaelt
// versteckte /games/store/-Links (Game Pass Ultimate), die sonst mitgezaehlt
// werden und beim Warten auf Sichtbarkeit haengen bleiben.
// Genres wirken auf den gesamten Konsolenkatalog (15.899 Titel). Kombiniert
// mit "Im Angebot" bleiben die Mengen klein genug fuer eine Erfassung je Genre;
// ueber alle fuenf Sichten waeren es 105 Durchlaeufe und damit unverhaeltnismaessig.
export const XBOX_GENRES = ['Action & Abenteuer','Andere','Begleiter','Bildung','Casino','Familie & Kinder','Kampfspiele','Karte & Brett','Klassiker','Multi-Player Online Battle Arena','Musik','Platformer','Rennen & Fliegen','Rollenspiele','Rätsel & Wissen','Shooter','Simulation','Sport','Strategiespiele','Werkzeuge','Wort- und Sprachspiele'];

const CARD = 'a:has([class*="ProductCard-module__title"])';

export function minorUnits(text) {
  const match = String(text || '').match(/(\d[\d.]*),(\d{2})\s*€/);
  if (!match) return null;
  return Number(match[1].replace(/\./g, '')) * 100 + Number(match[2]);
}
export function bigId(href) {
  try {
    const path = new URL(href, 'https://www.xbox.com').pathname.replace(/\/+$/, '');
    const id = path.split('/').pop();
    // Microsoft-Store-Big-IDs sind rein alphanumerisch (in der Praxis 12
    // Zeichen). Ein Slug mit Bindestrichen ist keine Produktidentitaet.
    return /^[A-Za-z0-9]{10,14}$/.test(id) ? id.toLowerCase() : null;
  } catch { return null; }
}
export function countFromText(text) {
  const match = String(text || '').match(/\(\s*([\d.]+)\s*Spiele/i);
  return match ? Number(match[1].replace(/\./g, '')) : null;
}

async function dismissConsent(page) {
  const button = page.locator('#wcpConsentBannerCtrl button').first();
  await button.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  if (await button.isVisible().catch(() => false)) await button.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
async function readCount(page) {
  return countFromText(await page.evaluate(() => {
    const node = [...document.querySelectorAll('*')].find(el => !el.children.length && /durchsuchen\s*\(/.test(el.textContent || ''));
    return node ? node.textContent.trim() : '';
  }));
}
async function settledCount(page, previousValue) {
  // Der Zaehler haengt dem Filterwechsel nach und laeuft dabei ueber den alten
  // Wert. Er gilt erst, wenn er stabil ist und sich vom Ausgangswert loest.
  let last = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const value = await readCount(page);
    if (Number.isInteger(value) && value === last && value !== previousValue) return value;
    last = value;
    await page.waitForTimeout(500);
  }
  return null;
}
async function applyFilter(page, group, option) {
  const header = page.getByRole('button', { name: new RegExp(`^${group}`) }).first();
  if (!await header.count()) throw new Error(`Filtergruppe "${group}" nicht gefunden`);
  await header.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await header.click({ timeout: 8000 });
  const choice = page.getByText(option, { exact: true }).first();
  await choice.waitFor({ state: 'visible', timeout: 8000 });
  await choice.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
}
async function loadAll(page, expected) {
  // "Mehr laden" haengt an, statt zu blaettern. Abbruch, sobald die Liste nicht
  // mehr waechst - ein stehengebliebener Button beendet die Sicht sauber,
  // statt sie per Timeout zu verlieren.
  let previous = -1, stalled = 0;
  for (let round = 0; round < 400; round++) {
    const count = await page.locator(CARD).count();
    if (Number.isInteger(expected) && count >= expected) break;
    // Ein einzelner Klick kann folgenlos bleiben; erst mehrfaches Ausbleiben
    // von Wachstum beendet die Sicht, sonst gehen die letzten Eintraege verloren.
    if (count === previous) { if (++stalled >= 3) break; } else stalled = 0;
    previous = count;
    const more = page.locator('[aria-label="Mehr laden"]').first();
    if (!await more.count() || !await more.isVisible().catch(() => false)) break;
    await more.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await more.click({ timeout: 10000 }).catch(() => {});
    await page.waitForFunction(
      ([selector, seen]) => document.querySelectorAll(selector).length > seen,
      [CARD, count], { timeout: 20000 },
    ).catch(() => {});
  }
}
async function readCards(page) {
  return page.evaluate((selector) => [...document.querySelectorAll(selector)].map((link) => {
    const card = link.closest('div,li,article') || link;
    const text = (query) => card.querySelector(query)?.textContent?.trim() || null;
    const image = card.querySelector('img[src*="store-images.s-microsoft.com"]');
    // Prefer an original, higher-resolution candidate already advertised by
    // the official responsive image, rather than the small thumbnail's src.
    const candidates = (image?.getAttribute('srcset') || '').split(',').map((entry) => {
      const [url, descriptor] = entry.trim().split(/\s+/);
      const width = Number(descriptor?.match(/^(\d+)w$/)?.[1] || 0);
      return { url, width };
    }).filter(({ url, width }) => url?.startsWith('https://store-images.s-microsoft.com/') && width > 0)
      .sort((a, b) => b.width - a.width);
    const cover = candidates[0]?.url || image?.currentSrc || image?.src || null;
    return {
      href: link.href,
      title: text('[class*="ProductCard-module__title"]'),
      price: text('[class*="Price-module__boldText"]'),
      regularPrice: text('[class*="Price-module__originalPrice"]'),
      discount: text('[class*="ProductCard-module__discountTag"]'),
      cover,
      gamePass: [...card.querySelectorAll('title')].some(node => /game\s*pass/i.test(node.textContent || '')),
    };
  }), CARD);
}

export async function collectView(page, key, view, baseline) {
  await applyFilter(page, view.group, view.option);
  const expected = await settledCount(page, baseline);
  if (!Number.isInteger(expected)) throw new Error(`${key}: Anzahl nicht von der Ausgangszahl unterscheidbar`);
  await loadAll(page, expected);
  const seen = await readCards(page);
  const entries = new Map();
  let invalid = 0;
  for (const card of seen) {
    const id = bigId(card.href);
    if (!id || !card.title) { invalid += 1; continue; }
    entries.set(id, { ...card, id });
  }
  return { key, view, expected, observed: seen.length, invalid, entries: [...entries.values()] };
}

export async function collectXboxViews(keys = Object.keys(XBOX_VIEWS), { headless = true } = {}) {
  const results = {}, errors = [], genres = {};
  // Unbekannte Sichten vorab abweisen: ohne gueltige Sicht gibt es nichts zu
  // holen, und ein Browserstart waere verschwendet.
  const valid = keys.filter((key) => {
    if (XBOX_VIEWS[key]) return true;
    errors.push(`${key}: unbekannte Sicht`);
    results[key] = { key, view: null, expected: null, observed: 0, invalid: 0, entries: [] };
    return false;
  });
  if (!valid.length) return { checkedAt: new Date().toISOString(), sourceUrl: XBOX_CATALOG, target: XBOX_TARGET, results, errors };

  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    for (const key of valid) {
      const view = XBOX_VIEWS[key];
      try {
        // Pro Sicht frisch laden: "Mehr laden" haengt an und Filter summieren
        // sich sonst ueber die Sichten hinweg.
        await page.goto(XBOX_CATALOG, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await dismissConsent(page);
        await page.locator(CARD).first().waitFor({ timeout: 60000 });
        const baseline = await readCount(page);
        results[key] = await collectView(page, key, view, baseline);
      } catch (error) {
        errors.push(`${key}: ${error.message}`);
        results[key] = { key, view, expected: null, observed: 0, invalid: 0, entries: [] };
      }
    }
  } finally { await browser.close(); }
  return { checkedAt: new Date().toISOString(), sourceUrl: XBOX_CATALOG, target: XBOX_TARGET, results, genres, errors };
}

// Genres fuer die Angebotsansicht. Pro Genre frisch laden und beide Filter neu
// setzen - das ist langsamer als ein Chip-Klick, aber der Ausgangszustand ist
// dadurch garantiert und die Zuordnung nachweisbar.
export async function collectDealGenres(labels = XBOX_GENRES, { headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const genres = {}, errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    for (const label of labels) {
      try {
        await page.goto(XBOX_CATALOG, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await dismissConsent(page);
        await page.locator(CARD).first().waitFor({ timeout: 60000 });
        const baseline = await readCount(page);
        await applyFilter(page, 'Preise', 'Im Angebot');
        const dealCount = await settledCount(page, baseline);
        await applyFilter(page, 'Genre', label);
        const expected = await settledCount(page, dealCount);
        if (!Number.isInteger(expected)) throw new Error('Anzahl nicht unterscheidbar');
        await loadAll(page, expected);
        const cards = await readCards(page);
        if (cards.length !== expected) throw new Error(`${cards.length}/${expected} Karten, nicht uebernommen`);
        for (const card of cards) {
          const id = bigId(card.href);
          if (id) (genres[id] ||= []).push(label);
        }
      } catch (error) { errors.push(`Genre ${label}: ${error.message}`); }
    }
  } finally { await browser.close(); }
  for (const list of Object.values(genres)) list.sort((a, b) => a.localeCompare(b, 'de'));
  return { genres, errors };
}

// Rohdaten in den plattformneutralen Vertrag ueberfuehren. Nichts wird
// ergaenzt: ohne Preis kein Angebot, ohne Abo-Sicht keine Berechtigung.
export function buildXboxSnapshot(raw) {
  const evidence = [], products = new Map(), offers = [], entitlements = [];
  const views = {};
  let invalid = 0;
  const errors = [...(raw.errors || [])];

  for (const [key, result] of Object.entries(raw.results || {})) {
    const complete = Number.isInteger(result.expected) && result.observed === result.expected && result.invalid === 0;
    views[key] = { expected: result.expected, observed: result.observed, count: result.entries.length, complete };
    if (!complete) errors.push(`${key}: ${result.observed}/${result.expected ?? '?'} Karten gesehen`);
    invalid += result.invalid || 0;
    if (!result.entries.length || !result.view) continue;

    const evidenceId = `view:${key}`;
    evidence.push({
      id: evidenceId, sourceId: 'xbox-all-games-de', url: raw.sourceUrl, level: 'store',
      region: 'DE', observedAt: raw.checkedAt,
      note: `Filter ${result.view.group} = ${result.view.option}, Ziel ${raw.target}`,
    });

    for (const entry of result.entries) {
      const key2 = productKey('xbox', 'product', entry.id);
      if (!products.has(key2)) {
        products.set(key2, {
          platform: 'xbox', kind: 'product', id: entry.id, title: entry.title,
          productType: 'game', targets: [raw.target], storeUrl: entry.href,
          cover: entry.cover || null, evidenceIds: [evidenceId],
        });
      } else if (!products.get(key2).evidenceIds.includes(evidenceId)) {
        products.get(key2).evidenceIds.push(evidenceId);
      }

      const priceMinor = minorUnits(entry.price);
      if (priceMinor !== null) {
        const regularPriceMinor = minorUnits(entry.regularPrice);
        offers.push({
          id: `offer:${key}:${entry.id}`, productKey: key2, currency: 'EUR', region: 'DE',
          priceMinor, regularPriceMinor: regularPriceMinor !== null && regularPriceMinor >= priceMinor ? regularPriceMinor : null,
          observedAt: raw.checkedAt, evidenceIds: [evidenceId],
        });
      }
      if (result.view.serviceId) {
        entitlements.push({
          id: `entitlement:${key}:${entry.id}`, productKey: key2,
          serviceId: result.view.serviceId, tierId: result.view.tierId,
          accessKind: 'catalog', targets: [raw.target], region: 'DE', evidenceIds: [evidenceId],
        });
      }
    }
  }

  // Die Vereinigung geprüfter Teilsichten ist kein Beleg für den gesamten
  // Katalog. expected bleibt daher null; die Vollstaendigkeit steht je Sicht.
  return {
    schemaVersion: 1, platform: 'xbox', region: 'DE', checkedAt: raw.checkedAt,
    coverage: { complete: false, expected: null, count: products.size, invalid, errors, views, target: raw.target },
    products: [...products.values()], offers, entitlements, evidence,
  };
}
