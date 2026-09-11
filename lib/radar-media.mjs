import { catalogCover, storeIdentity, titleKey, verifiedImage } from './ps-plus-catalog.mjs';
export function safePlusCover(game, radar, catalog, seed = {}) {
  const storeUrl = game.storeUrl || radar?.resolvedSources?.psPlusStoreUrls?.[game.title] || radar?.gameDetails?.[game.title]?.storeUrl || seed.storeUrl;
  const fromCatalog = catalogCover(catalog, game.title, storeUrl);
  if (fromCatalog) return fromCatalog;
  const details = { ...seed, ...(radar?.gameDetails?.[game.title] || {}) };
  if (!details.coverImage && seed.coverImage) details.coverImage = seed.coverImage;
  if (storeIdentity(storeUrl) && storeIdentity(storeUrl) === storeIdentity(details.storeUrl) && (!details.title || titleKey(details.title) === titleKey(game.title))) return verifiedImage(details.coverImage);
  return null;
}
export function dailyLabel(date, today) {
  const normalize = value => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
  };
  const actual = normalize(date), current = normalize(today);
  if (!actual || !current) return 'AKTUELL';
  if (actual > current) return `AB ${actual.slice(8)}.${actual.slice(5,7)}.`;
  return actual === current ? 'HEUTE NEU' : `SEIT ${actual.slice(8)}.${actual.slice(5,7)}.`;
}
