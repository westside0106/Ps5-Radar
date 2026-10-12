import fs from 'node:fs/promises';
import { collectXboxSnapshot } from '../lib/providers/xbox/adapter.mjs';
import { collectDealGenres } from '../lib/providers/xbox/collector.mjs';

const directory = new URL('../data/platforms/xbox/', import.meta.url);
const output = new URL('snapshot.json', directory);
const previous = await fs.readFile(output, 'utf8').then(JSON.parse).catch(() => null);
const previousView = await fs.readFile(new URL('radar.json', directory), 'utf8').then(JSON.parse).catch(() => null);

const snapshot = await collectXboxSnapshot();

// Ein fehlgeschlagener Lauf darf einen gueltigen Stand nicht loeschen. Der
// bewahrte Stand behaelt seinen eigenen Zeitstempel, gilt also als veraltet.
if (!snapshot.products.length && previous?.products?.length) {
  console.log('::warning::Xbox-Lauf ohne Produkte - letzter gueltiger Stand bleibt erhalten.');
  for (const message of snapshot.coverage.errors) console.log(`::warning::Xbox ${message}`);
  process.exit(1);
}

await fs.mkdir(directory, { recursive: true });
await fs.writeFile(output, JSON.stringify(snapshot, null, 2) + '\n');

const views = Object.entries(snapshot.coverage.views || {})
  .map(([key, view]) => `${key} ${view.observed}/${view.expected ?? '?'}${view.complete ? ' ✓' : ''}`)
  .join(', ');
console.log(`Xbox snapshot: ${snapshot.products.length} Produkte, ${snapshot.offers.length} Angebote, ${snapshot.entitlements.length} Berechtigungen`);
console.log(`Sichten: ${views}`);
for (const message of snapshot.coverage.errors) console.log(`::warning::Xbox ${message}`);

// A fast recovery run can skip the expensive 21-genre scrape, preserving
// previously verified genres only for unchanged Microsoft product IDs.
// The daily full refresh still performs source-verified genre collection.
const cachedGenres = Object.fromEntries((previousView?.games || [])
  .filter(game => game.id && game.genres?.length).map(game => [game.id, game.genres]));
const skipGenres = process.env.XBOX_SKIP_GENRES === '1';
const genreResult = skipGenres ? { genres: {}, errors: [] } : await collectDealGenres();
const genres = { ...cachedGenres, ...genreResult.genres };
for (const message of genreResult.errors) console.log(`::warning::Xbox ${message}`);
console.log(`Genres: ${Object.keys(genreResult.genres).length} frisch, ${Object.keys(cachedGenres).length} vorher belegt, ${skipGenres ? 'schneller Wiederherstellungslauf' : 'vollstaendige Neuerfassung'}`);

// Abgeleitete Ansicht: der vollstaendige Snapshot mit Belegen je Angebot und
// Berechtigung ist fuer die Seite zu gross. Hier bleibt pro Produkt genau das,
// was die Ansicht braucht - abgeleitet, nicht ergaenzt.
const offerByProduct = new Map();
for (const offer of snapshot.offers) {
  const current = offerByProduct.get(offer.productKey);
  if (!current || offer.priceMinor < current.priceMinor) offerByProduct.set(offer.productKey, offer);
}
const servicesByProduct = new Map();
for (const entitlement of snapshot.entitlements) {
  const list = servicesByProduct.get(entitlement.productKey) || [];
  const id = `${entitlement.serviceId}:${entitlement.tierId}`;
  if (!list.includes(id)) list.push(id);
  servicesByProduct.set(entitlement.productKey, list);
}
const view = {
  schemaVersion: 1,
  platform: 'xbox',
  region: 'DE',
  target: snapshot.coverage.target,
  checkedAt: snapshot.checkedAt,
  sourceUrl: snapshot.evidence[0]?.url || 'https://www.xbox.com/de-DE/games/all-games/console?PlayWith=XboxSeriesX%7CS',
  coverage: { complete: snapshot.coverage.complete, count: snapshot.coverage.count, views: snapshot.coverage.views, errors: snapshot.coverage.errors },
  evidence: snapshot.evidence,
  games: snapshot.products.map((product) => {
    const offer = offerByProduct.get(product.key) || null;
    return {
      key: product.key, id: product.id, title: product.title, storeUrl: product.storeUrl,
      cover: product.cover, targets: product.targets,
      priceMinor: offer ? offer.priceMinor : null,
      regularPriceMinor: offer ? offer.regularPriceMinor : null,
      genres: genres[product.id] || [],
      services: (servicesByProduct.get(product.key) || []).sort(),
    };
  }).sort((a, b) => a.title.localeCompare(b.title, 'de')),
};
await fs.writeFile(new URL('radar.json', directory), JSON.stringify(view, null, 2) + '\n');
console.log(`Ansicht: ${view.games.length} Spiele nach data/platforms/xbox/radar.json`);
