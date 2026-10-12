import { chromium } from 'playwright';
import { productKey } from '../../platform-core/model.mjs';

// Offizielle Katalogansicht. Der PlayWith-Parameter legt die Zielplattform
// ausdruecklich fest; ohne ihn mischt die Seite drei Ziele per ODER und die
// targets eines Produkts waeren nicht belegbar.
export const XBOX_TARGET = 'xbox-series';
export const XBOX_CATALOG = 'https://www.xbox.com/de-DE/games/all-games/console?PlayWith=XboxSeriesX%7CS';
export const XBOX_GAMEPASS_CATALOG = 'https://www.xbox.com/de-DE/xbox-game-pass/games';

// Jede Sicht ist eine Filteroption der offiziellen Seite. Game Pass wird nach
// Tier getrennt gefuehrt; EA Play und Ubisoft+ sind eigene Dienste, kein
// pauschales "enthalten".
export const XBOX_VIEWS = {
  deals:              { group: 'Preise',      option: 'Im Angebot' },
  // Microsoft now sells Essential/Premium/Ultimate; "für Konsole" is legacy.
  // The current plan selector is on the official Game Pass games catalog.
  'gamepass-essential': { source: 'gamepass', group: 'Abonnements', option: 'XBOX Game Pass Essential', serviceId: 'xbox-game-pass', tierId: 'essential' },
  'gamepass-premium':   { source: 'gamepass', group: 'Abonnements', option: 'XBOX Game Pass Premium',   serviceId: 'xbox-game-pass', tierId: 'premium' },
  'gamepass-ultimate':{ group: 'Abonnements', option: 'Game Pass Ultimate',    serviceId: 'xbox-game-pass', tierId: 'ultimate' },
  'ea-play':          { source: 'gamepass', group: 'Sammlungen', option: 'EA Play', serviceId: 'ea-play', tierId: 'ea-play' },
  'ubisoft-plus':     { group: 'Abonnements', option: 'Ubisoft+',              serviceId: 'ubisoft-plus',   tierId: 'ubisoft-plus' },
};

// An die Kartenstruktur gebunden, nicht an den Link: die Kopfleiste enthaelt
// versteckte /games/store/-Links (Game Pass Ultimate), die sonst mitgezaehlt
// werden und beim Warten auf Sichtbarkeit haengen bleiben.
// Genres wirken auf den gesamten Konsolenkatalog (15.899 Titel). Kombiniert
// mit "Im Angebot" bleiben die Mengen klein genug fuer eine Erfassung je Genre;
// ueber alle fuenf Sichten waeren es 105 Durchlaeufe und damit unverhaeltnismaessig.
export const XBOX_GENRES = ['Action & Abenteuer','Andere','Begleiter','Bildung','Casino','Familie & Kinder','Kampfspiele','Karte & Brett','Klassiker','Multi-Player Online Battle Arena','Musik','Platformer','Rennen & Fliegen','Rollenspiele','Rätsel & Wissen','Shooter','Simulation','Sport','Strategiespiele','Werkzeuge','Wort- und Sprachspiele'];

// Some store cards use a different title layout. Require a product-card image
// for the fallback so navigation links are never counted as games.
const CARD = 'a:has([class*="ProductCard-module__title"]), a[href*="/games/store/"]:has(img[src*="store-images.s-microsoft.com"])';

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
export function stableCountDecision({ value, previous, repeated, filterConfirmed, cardsChanged }) {
  if (!Number.isInteger(value) || value < 0 || !repeated) return false;
  // Unchanged counts are not automatically failures: different filters can
  // legitimately have equally many products. But both the selected-state
  // evidence and a changed card sample are required in that case.
  return value !== previous || (filterConfirmed && cardsChanged);
}
async function visibleProductIds(page) {
  const urls = await page.locator(CARD).evaluateAll(links => links.slice(0, 25).map(node => node.href));
  return urls.map(bigId).filter(Boolean).join('|');
}
async function selectionConfirmed(page, option) {
  // Prefer accessible checked controls; fall back to explicit aria state.
  for (const role of ['checkbox', 'radio']) {
    const controls = page.getByRole(role, { name: option, exact: true });
    if (await controls.count() && await controls.first().isChecked().catch(() => false)) return true;
  }
  const optionNode = page.getByText(option, { exact: true }).first();
  if (!await optionNode.count()) return false;
  return optionNode.evaluate(node => {
    const chain = [node, node.parentElement, node.parentElement?.parentElement].filter(Boolean);
    return chain.some(el => el.getAttribute('aria-checked') === 'true'
      || el.getAttribute('aria-selected') === 'true'
      || el.getAttribute('aria-pressed') === 'true'
      || (el instanceof HTMLInputElement && el.checked)
      || el.querySelector('input:checked, [role="checkbox"][aria-checked="true"], [role="radio"][aria-checked="true"]'))
      || Boolean(node.closest('label')?.querySelector('input:checked'));
  }).catch(() => false);
}
async function settledCount(page, previousValue, option, initialIds) {
  // Wait for the source count to stabilize. A count equal to the baseline is
  // accepted only with corroborating UI evidence, never on assumption.
  let last = null;
  for (let attempt = 0; attempt < 48; attempt++) {
    const value = await readCount(page);
    const cardsChanged = initialIds !== await visibleProductIds(page);
    const confirmed = await selectionConfirmed(page, option);
    if (stableCountDecision({
      value, previous: previousValue, repeated: value === last,
      filterConfirmed: Boolean(confirmed), cardsChanged,
    })) return value;
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
  return selectionConfirmed(page, option);
}
async function loadAll(page, expected) {
  // "Mehr laden" haengt an, statt zu blaettern. Abbruch, sobald die Liste nicht
  // mehr waechst - ein stehengebliebener Button beendet die Sicht sauber,
  // statt sie per Timeout zu verlieren.
  let previous = -1, stalled = 0;
  for (let round = 0; round < 400; round++) {
    const count = await page.locator(CARD).count();
    if (Number.isInteger(expected) && count >= expected) break;
    // Retry a stalled load rather than losing the final catalog page.
    if (count === previous) { if (++stalled >= 5) break; } else stalled = 0;
    previous = count;
    const more = page.locator('[aria-label="Mehr laden"]').first();
    if (!await more.count() || !await more.isVisible().catch(() => false)) {
      await page.locator(CARD).last().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(900);
      if (!await more.count() || !await more.isVisible().catch(() => false)) break;
    }
    await more.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await more.click({ timeout: 10000 }).catch(() => {});
    await page.waitForFunction(
      ([selector, seen]) => document.querySelectorAll(selector).length > seen,
      [CARD, count], { timeout: 15000 },
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
      title: text('[class*="ProductCard-module__title"]')
        || link.getAttribute('aria-label')?.trim()
        || image?.alt?.trim()
        || null,
      price: text('[class*="Price-module__boldText"]'),
      regularPrice: text('[class*="Price-module__originalPrice"]'),
      discount: text('[class*="ProductCard-module__discountTag"]'),
      cover,
      gamePass: [...card.querySelectorAll('title')].some(node => /game\s*pass/i.test(node.textContent || '')),
    };
  }), CARD);
}

export async function collectView(page, key, view, baseline) {
  const initialIds = await visibleProductIds(page);
  await applyFilter(page, view.group, view.option);
  const expected = await settledCount(page, baseline, view.option, initialIds);
  if (!Number.isInteger(expected)) {
    const actual = await readCount(page);
    const loaded = await page.locator(CARD).count();
    const selected = await selectionConfirmed(page, view.option);
    throw new Error(`${key}: Filterzaehler nicht bestaetigt (Basis ${baseline ?? '?'}, Anzeige ${actual ?? '?'}, Karten ${loaded}, Auswahl ${selected})`);
  }
  // Zero can also mean a failed Microsoft catalog request. Never label a
  // source view empty unless the filter's checked state is independently proven.
  if (expected === 0 && !(await selectionConfirmed(page, view.option))) {
    throw new Error(`${key}: Nullergebnis ohne bestaetigte Filterauswahl`);
  }
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

// The Game Pass library has a different filter UI from the all-games store.
// Do not infer membership from publishers, badges, or a broad search result.
const GAMEPASS_CARD = 'main a[href*="/games/store/"], #PageContent a[href*="/games/store/"]';

async function openGamePassFilters(page) {
  const toggle = page.getByRole('button', { name: /^FILTER$/i }).first();
  if (await toggle.count() && await toggle.isVisible().catch(() => false)) {
    await toggle.click({ timeout: 8000 }).catch(() => {});
  }
}

async function selectGamePassFilter(page, group, option) {
  const groupButton = page.getByRole('button', { name: new RegExp(group, 'i') }).first();
  if (!await groupButton.count()) throw new Error(`Filtergruppe ${group} auf Game-Pass-Seite fehlt`);
  await groupButton.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
  await groupButton.click({ timeout: 8000 }).catch(() => {});
  for (const role of ['checkbox', 'radio']) {
    const check = page.getByRole(role, { name: option, exact: true }).first();
    if (!await check.count()) continue;
    await check.check({ timeout: 8000 });
    if (!await check.isChecked()) throw new Error(`Filter ${option} nicht aktiviert`);
    return;
  }
  const text = page.getByText(option, { exact: true }).first();
  if (!await text.count()) throw new Error(`Filter ${option} auf Game-Pass-Seite fehlt`);
  await text.click({ timeout: 8000 });
  if (!await selectionConfirmed(page, option)) throw new Error(`Filter ${option} ist nicht als ausgewaehlt bestaetigt`);
}

async function gamePassCount(page) {
  return page.evaluate(() => {
    const elements = [...document.querySelectorAll('main *, #PageContent *')]
      .filter(el => !el.children.length && /Spiele\s*\(\s*[\d.]+\s*\)/i.test(el.textContent || ''));
    for (const el of elements) {
      const match = (el.textContent || '').match(/Spiele\s*\(\s*([\d.]+)\s*\)/i);
      if (match) return Number(match[1].replace(/\./g, ''));
    }
    return null;
  });
}

async function loadGamePassCards(page, expected) {
  let same = 0, last = -1;
  for (let round = 0; round < 150; round++) {
    const count = await page.locator(GAMEPASS_CARD).count();
    if (Number.isInteger(expected) && count >= expected) break;
    same = count === last ? same + 1 : 0;
    last = count;
    if (same >= 5) break;
    const more = page.getByRole('button', { name: /mehr laden|mehr anzeigen|weitere spiele|show more|load more/i }).first();
    if (await more.count() && await more.isVisible().catch(() => false)) {
      await more.click({ timeout: 8000 }).catch(() => {});
    } else {
      await page.locator(GAMEPASS_CARD).last().scrollIntoViewIfNeeded().catch(() => {});
    }
    await page.waitForTimeout(800);
  }
}

async function readGamePassCards(page) {
  return page.locator(GAMEPASS_CARD).evaluateAll(links => links.map(link => {
    const tile = link.closest('article, li, [class*="GameCard"], [class*="ProductCard"]') || link;
    const image = link.querySelector('img') || tile.querySelector('img');
    const title = link.getAttribute('aria-label') || tile.querySelector('h3, h4, [class*="title"]')?.textContent
      || image?.alt || link.textContent;
    return {
      href: link.href, title: String(title || '').trim(),
      cover: image?.currentSrc || image?.src || null,
      price: null, regularPrice: null,
    };
  }));
}

export async function collectGamePassView(page, key, view) {
  await openGamePassFilters(page);
  // Both filters MUST be positively checked before associating games with a
  // subscription and a console. A missing checkbox is a failed collection.
  await selectGamePassFilter(page, 'Spielen auf', 'XBOX Series X|S');
  await selectGamePassFilter(page, view.group, view.option);
  let expected = null, last = null;
  for (let i = 0; i < 36; i++) {
    const count = await gamePassCount(page);
    if (Number.isInteger(count) && count > 0 && count === last) { expected = count; break; }
    last = count;
    await page.waitForTimeout(500);
  }
  if (!Number.isInteger(expected) || expected <= 0) throw new Error(`${key}: Game-Pass-Quelle ohne bestaetigte Spieleanzahl`);
  await loadGamePassCards(page, expected);
  const found = await readGamePassCards(page);
  const entries = new Map();
  let invalid = 0;
  for (const card of found) {
    const id = bigId(card.href);
    if (!id || !card.title) { invalid++; continue; }
    entries.set(id, { ...card, id });
  }
  if (!entries.size) throw new Error(`${key}: Game-Pass-Quelle ohne identifizierbare Produktkarten`);
  return {
    key, view, expected, observed: entries.size,
    invalid, entries: [...entries.values()], sourceUrl: XBOX_GAMEPASS_CATALOG,
  };
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
      let combined = null;
      let successfulAttempts = 0;
      const notes = [];
      // Retry each incomplete view once from a clean page. Combine only IDs
      // explicitly seen with the SAME filter and SAME authoritative count.
      // This addresses last-page loading races without inventing membership.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const sourceUrl = view.source === 'gamepass' ? XBOX_GAMEPASS_CATALOG : XBOX_CATALOG;
          await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await dismissConsent(page);
          let result;
          if (view.source === 'gamepass') {
            result = await collectGamePassView(page, key, view);
          } else {
            await page.locator(CARD).first().waitFor({ timeout: 60000 });
            const baseline = await readCount(page);
            result = await collectView(page, key, view, baseline);
          }
          successfulAttempts++;
          if (!combined || result.expected !== combined.expected) {
            if (combined && result.expected !== combined.expected) {
              notes.push(`Anzahl wechselte von ${combined.expected} auf ${result.expected}; vorherige Produkte nicht zusammengefuehrt`);
            }
            combined = { ...result, entries: [...result.entries] };
          } else {
            const byId = new Map([...combined.entries, ...result.entries].map(entry => [entry.id, entry]));
            combined.entries = [...byId.values()];
          }
          combined.observed = combined.entries.length;
          combined.invalid = combined.observed >= combined.expected ? 0 : Math.max(result.invalid, 0);
          combined.attempts = attempt;
          if (combined.observed === combined.expected && combined.invalid === 0) break;
          notes.push(`Durchlauf ${attempt}: ${combined.observed}/${combined.expected} eindeutige IDs`);
        } catch (error) {
          notes.push(`Durchlauf ${attempt}: ${error.message}`);
        }
      }
      if (combined) {
        results[key] = combined;
        if (combined.observed !== combined.expected || combined.invalid) {
          errors.push(`${key}: ${combined.observed}/${combined.expected} eindeutig belegt, ${notes.join('; ')}`);
        }
      } else {
        errors.push(`${key}: keine bestaetigte Quelle (${notes.join('; ')})`);
        results[key] = { key, view, expected: null, observed: 0, invalid: 0, entries: [], attempts: 2 };
      }
      if (successfulAttempts < 2 && notes.length) console.log(`Xbox ${key}: ${notes.join('; ')}`);
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
    const complete = Number.isInteger(result.expected) && result.observed === result.expected
      && result.entries.length === result.expected && result.invalid === 0;
    views[key] = { expected: result.expected, observed: result.observed, count: result.entries.length, complete, attempts: result.attempts || 1 };
    if (!complete) errors.push(`${key}: ${result.observed}/${result.expected ?? '?'} Karten gesehen`);
    invalid += result.invalid || 0;
    if (!result.entries.length || !result.view) continue;

    const evidenceId = `view:${key}`;
    evidence.push({
      id: evidenceId, sourceId: result.sourceUrl === XBOX_GAMEPASS_CATALOG ? 'xbox-game-pass-de' : 'xbox-all-games-de', url: result.sourceUrl || raw.sourceUrl, level: 'store',
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
