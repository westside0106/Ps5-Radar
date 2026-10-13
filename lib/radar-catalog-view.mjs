import { catalogFilter as baseCatalogFilter, catalogStatus, mergeRadarCatalog } from './ps-plus-catalog.mjs';
import { currentEssential } from './ps-plus-current.mjs';

// Only expose catalog areas for which the pipeline has useful, browsable data.
// Trials and "Verlässt bald" are intentionally omitted: the official catalog
// does not expose complete machine-readable collections for either area, so an
// empty pseudo-catalog is less useful than no tab at all.
export const CATALOG_TABS = [
  { id: 'essential', label: 'Essential' },
  { id: 'extra', label: 'Extra' },
  { id: 'premium', label: 'Premium · Klassiker' },
  { id: 'ubisoft', label: 'Ubisoft+ Classics' }
];

export function prepareCatalog(catalog, radar, now = new Date()) {
  const games = mergeRadarCatalog(catalog, radar);
  const byTitle = new Map(games.map(game => [game.title.toLocaleLowerCase('de'), game]));
  // Never propagate an expired monthly claim window into a current catalog,
  // especially not to games listed under Extra or another service.
  const essential = currentEssential(radar, catalog, now);
  if (essential.kind === 'monthly') {
    for (const item of essential.games) {
      const game = byTitle.get(item.title.toLocaleLowerCase('de'));
      if (game?.services?.includes('essential')) {
        game.claimWindow = essential.text || null;
        game.monthLabel = essential.label || null;
      }
    }
  }

  const verifiedAdds = new Map();
  for (const change of catalog?.changes || []) {
    if (change.kind !== 'added' || !change.id || !change.date) continue;
    const previous = verifiedAdds.get(change.id);
    if (!previous || change.date > previous) verifiedAdds.set(change.id, change.date);
  }
  const enriched = games.map(game => {
    const info = radar?.gameDetails?.[game.title] || {};
    return {
      ...game,
      addedAt: game.addedAt || verifiedAdds.get(game.id) || null,
      description: info.description || game.description || null,
      releaseDate: game.releaseDate || (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(info.release || '') ? info.release.split('.').reverse().map((part, index) => index ? part.padStart(2, '0') : part).join('-') : null),
      genre: info.genre || game.genre || null,
      developer: info.developer || null,
      publisher: info.publisher || null,
      trailerUrl: info.trailerUrl || null,
      modes: Array.isArray(game.modes) ? game.modes : (Array.isArray(info.modes) ? info.modes : []),
      perspective: game.perspective || info.perspective || null,
      playtimeHours: Number.isFinite(game.playtimeHours) ? game.playtimeHours : (Number.isFinite(info.playtimeHours) ? info.playtimeHours : null),
      gallery: game.image ? [game.image] : [],
      platforms: game.platforms?.length ? game.platforms : String(info.platform || '').match(/\bPS[45]\b/g) || []
    };
  });

  const sections = Object.fromEntries(CATALOG_TABS.map(tab => [tab.id, catalogStatus(catalog, tab.id, now)]));
  sections.essential = {
    ...sections.essential,
    count: enriched.filter(game => game.services.includes('essential')).length
  };

  return {
    games: enriched,
    changes: Array.isArray(catalog?.changes) ? catalog.changes : [],
    sections,
    checkedAt: catalog?.checkedAt || null,
    sourceUrl: catalog?.sourceUrl,
    errors: catalog?.errors || []
  };
}

// Sort only by attributes present in the verified catalog. Unknown values
// always go last and ties fall back to title for predictable pagination.
export function catalogFilter(games, options = {}) {
  const sort = options.sort || 'title';
  const filtered = baseCatalogFilter(games, { ...options, sort: ['recent', 'leaving'].includes(sort) ? sort : 'title' }).filter(game => {
    if (options.mode && options.mode !== 'all' && !game.modes?.includes(options.mode)) return false;
    if (options.perspective && options.perspective !== 'all' && game.perspective !== options.perspective) return false;
    if (options.playtime && options.playtime !== 'all') {
      if (!Number.isFinite(game.playtimeHours)) return false;
      const [lowText, highText] = options.playtime.split('-');
      const low = Number(lowText);
      const high = highText ? Number(highText) : Infinity;
      if (game.playtimeHours < low || (Number.isFinite(high) && game.playtimeHours >= high)) return false;
    }
    return true;
  });
  const byTitle = (a, b) => a.title.localeCompare(b.title, 'de');
  const compareKnown = (a, b, descending = false) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return descending ? b.localeCompare(a, 'de') : a.localeCompare(b, 'de');
  };
  if (sort === 'title-desc') filtered.sort((a, b) => -byTitle(a, b));
  if (sort === 'genre' || sort === 'genre-desc') {
    filtered.sort((a, b) => compareKnown(a.genres?.[0], b.genres?.[0], sort === 'genre-desc') || byTitle(a, b));
  }
  if (sort === 'ps5-first' || sort === 'ps4-first') {
    const platform = sort === 'ps5-first' ? 'PS5' : 'PS4';
    filtered.sort((a, b) => Number(Boolean(b.platforms?.includes(platform))) - Number(Boolean(a.platforms?.includes(platform))) || byTitle(a, b));
  }
  if (sort === 'cover-first' || sort === 'cover-last') {
    const direction = sort === 'cover-first' ? -1 : 1;
    filtered.sort((a, b) => direction * (Number(Boolean(a.image)) - Number(Boolean(b.image))) || byTitle(a, b));
  }
  if (sort === 'release-new' || sort === 'release-old') {
    filtered.sort((a, b) => compareKnown(a.releaseDate, b.releaseDate, sort === 'release-new') || byTitle(a, b));
  }
  return filtered;
}
