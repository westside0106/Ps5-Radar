import fs from 'node:fs/promises';
import { applyVerifiedPlusCovers, verifiedStoreCover } from './lib/media-identity.mjs';
import { emptyCatalog, storeIdentity, titleKey, verifiedImage } from '../lib/ps-plus-catalog.mjs';
const radarPath = new URL('../data/radar.json', import.meta.url);
const historyPath = new URL('../data/price-history.json', import.meta.url);
const catalogPath = new URL('../data/ps-plus-catalog.json', import.meta.url);
const sourcesPath = new URL('../data/game-sources.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const catalog = await fs.readFile(catalogPath, 'utf8').then(JSON.parse).catch(() => emptyCatalog());
const gameSources = await fs.readFile(sourcesPath, 'utf8').then(JSON.parse).catch(() => ({}));
const details = radar.gameDetails || {};
const warnings = [];

// The PS Plus catalog can expose a concept URL while the monthly source exposes
// the concrete product URL for the same title. In that case the identities are
// intentionally different even though the catalog cover is authoritative.
// Accept that cover only when the normalized title resolves to exactly one
// official catalog entry; ambiguous title matches still fall through to the
// stricter product/SKU verification below.
function exactCatalogCover(title) {
  const key = titleKey(title);
  if (!key) return null;
  const matches = (catalog?.games || []).filter(game => titleKey(game.title) === key && verifiedImage(game.image));
  return matches.length === 1 ? verifiedImage(matches[0].image) : null;
}

for (const game of radar.plusGames || []) {
  const info = details[game.title] || {};
  const storeUrl = game.storeUrl || radar.resolvedSources?.psPlusStoreUrls?.[game.title] || info.storeUrl || gameSources[game.title]?.storeUrl;
  if (!storeIdentity(storeUrl)) { warnings.push(`${game.title}: keine gueltige Store-Produkt-URL`); continue; }
  const catalogImage = exactCatalogCover(game.title);
  if (catalogImage) {
    details[game.title] = { ...info, storeUrl, coverImage: catalogImage, title: game.title };
    continue;
  }
  try {
    const response = await fetch(storeUrl, { headers: { 'accept-language': 'de-DE,de;q=0.9' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const image = verifiedStoreCover({ title: game.title, storeUrl, html: await response.text() });
    if (!image) throw new Error('Produktidentitaet oder Cover nicht bestaetigt');
    details[game.title] = { ...info, storeUrl, coverImage: image, title: game.title };
  } catch (error) { warnings.push(`${game.title}: ${error.message}`); }
}
radar.gameDetails = details;
applyVerifiedPlusCovers(radar, catalog);
radar.mediaValidation = { checkedAt: new Date().toISOString(), verified: radar.plusGames.filter(g => g.image).length, missing: radar.plusGames.filter(g => !g.image).map(g => g.title), warnings };
await fs.writeFile(radarPath, JSON.stringify(radar, null, 2) + '\n');
for (const warning of warnings) console.log(`::warning::PS-Plus-Cover ${warning}`);
console.log(`PS Plus covers: ${radar.mediaValidation.verified}/${radar.plusGames.length} verified`);

// Die Preisradar-Titel stammen aus Store-Deals und stehen nicht in gameDetails;
// ohne eigene Aufloesung bleiben ihre Kacheln bildlos. Dieselbe sku-gebundene
// Pruefung, keine Uebernahme fremder Bilder.
const history = await fs.readFile(historyPath, 'utf8').then(JSON.parse).catch(() => null);
if (history?.games) {
  let resolved = 0, total = 0;
  for (const game of Object.values(history.games)) {
    if (!storeIdentity(game.storeUrl)) continue;
    total += 1;
    if (game.image) { resolved += 1; continue; }
    try {
      const response = await fetch(game.storeUrl, { headers: { 'accept-language': 'de-DE,de;q=0.9' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const image = verifiedStoreCover({ title: game.title, storeUrl: game.storeUrl, html: await response.text() });
      if (image) { game.image = image; resolved += 1; }
      else console.log(`::warning::Preisradar-Cover ${game.title}: Produktidentitaet oder Cover nicht bestaetigt`);
    } catch (error) { console.log(`::warning::Preisradar-Cover ${game.title}: ${error.message}`); }
  }
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2) + '\n');
  console.log(`Price radar covers: ${resolved}/${total} verified`);
}
