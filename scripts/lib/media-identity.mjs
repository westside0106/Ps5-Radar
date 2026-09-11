import { titleKey, storeIdentity, verifiedImage, catalogCover } from '../../lib/ps-plus-catalog.mjs';
export function titleMatches(a, b) {
  const x = titleKey(a), y = titleKey(b);
  return Boolean(x && y && (x === y || x.replace(/\b(?:standard|digital|edition)\b/g,'').trim() === y.replace(/\b(?:standard|digital|edition)\b/g,'').trim()));
}
export function resolveGameCover({ title, storeUrl, catalog, details = {} }) {
  const catalogImage = catalogCover(catalog, title, storeUrl);
  if (catalogImage) return { image: catalogImage, source: 'official-catalog' };
  const id = storeIdentity(storeUrl);
  if (id && id === storeIdentity(details.storeUrl) && titleMatches(title, details.title || title)) {
    const image = verifiedImage(details.coverImage);
    if (image) return { image, source: 'official-product' };
  }
  return { image: null, source: 'unverified' };
}
export function applyVerifiedPlusCovers(radar, catalog) {
  const previous = radar.gameDetails || {};
  radar.plusGames = (radar.plusGames || []).map(game => {
    const storeUrl = game.storeUrl || radar.resolvedSources?.psPlusStoreUrls?.[game.title] || previous[game.title]?.storeUrl || null;
    const resolved = resolveGameCover({ title: game.title, storeUrl, catalog, details: previous[game.title] || {} });
    return { ...game, storeUrl, image: resolved.image, imageSource: resolved.source };
  });
  return radar;
}
