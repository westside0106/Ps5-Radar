import fs from 'node:fs/promises';
import { applyVerifiedPlusCovers, verifiedStoreCover } from './lib/media-identity.mjs';
import { emptyCatalog, storeIdentity } from '../lib/ps-plus-catalog.mjs';
const radarPath = new URL('../data/radar.json', import.meta.url);
const catalogPath = new URL('../data/ps-plus-catalog.json', import.meta.url);
const sourcesPath = new URL('../data/game-sources.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const catalog = await fs.readFile(catalogPath, 'utf8').then(JSON.parse).catch(() => emptyCatalog());
const gameSources = await fs.readFile(sourcesPath, 'utf8').then(JSON.parse).catch(() => ({}));
const details = radar.gameDetails || {};
const warnings = [];
for (const game of radar.plusGames || []) {
  const info = details[game.title] || {};
  const storeUrl = game.storeUrl || radar.resolvedSources?.psPlusStoreUrls?.[game.title] || info.storeUrl || gameSources[game.title]?.storeUrl;
  if (!storeIdentity(storeUrl)) { warnings.push(`${game.title}: keine gueltige Store-Produkt-URL`); continue; }
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
