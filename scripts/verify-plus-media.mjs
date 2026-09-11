import fs from 'node:fs/promises';
import { applyVerifiedPlusCovers } from './lib/media-identity.mjs';
import { emptyCatalog, storeIdentity, titleKey, verifiedImage } from '../lib/ps-plus-catalog.mjs';
const radarPath = new URL('../data/radar.json', import.meta.url);
const catalogPath = new URL('../data/ps-plus-catalog.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const catalog = await fs.readFile(catalogPath, 'utf8').then(JSON.parse).catch(() => emptyCatalog());
const details = radar.gameDetails || {};
const warnings = [];
function metadata(html, name) {
  const tags = [...html.matchAll(/<meta\s+[^>]*>/gi)].map(match => match[0]);
  for (const tag of tags) {
    if (!new RegExp(`(?:property|name)=["']${name}["']`, 'i').test(tag)) continue;
    return tag.match(/content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g,'&') || null;
  }
  return null;
}
for (const game of radar.plusGames || []) {
  const info = details[game.title] || {};
  const storeUrl = game.storeUrl || radar.resolvedSources?.psPlusStoreUrls?.[game.title] || info.storeUrl;
  if (!storeIdentity(storeUrl)) continue;
  try {
    const response = await fetch(storeUrl,{headers:{'accept-language':'de-DE,de;q=0.9'},signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const title = metadata(html,'og:title') || '';
    const image = verifiedImage(metadata(html,'og:image'));
    const normalized = titleKey(title).replace(/\b(?:standard|digital|edition|ps4|ps5|playstation|store|kaufen)\b/g,'').trim();
    const expected = titleKey(game.title).replace(/\b(?:standard|digital|edition|ps4|ps5)\b/g,'').trim();
    if (!image || !normalized.includes(expected)) throw new Error('Produktidentität oder Cover nicht bestätigt');
    details[game.title] = {...info,storeUrl,coverImage:image,title:game.title};
  } catch(error) {warnings.push(`${game.title}: ${error.message}`);}
}
radar.gameDetails=details;
applyVerifiedPlusCovers(radar,catalog);
radar.mediaValidation={checkedAt:new Date().toISOString(),verified:radar.plusGames.filter(g=>g.image).length,missing:radar.plusGames.filter(g=>!g.image).map(g=>g.title),warnings};
await fs.writeFile(radarPath,JSON.stringify(radar,null,2)+'\n');
console.log(`PS Plus covers: ${radar.mediaValidation.verified}/${radar.plusGames.length} verified`);
