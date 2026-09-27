import { catalogFilter, catalogStatus, mergeRadarCatalog } from './ps-plus-catalog.mjs';

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
  for (const item of radar?.plusGames || []) {
    const game = byTitle.get(item.title.toLocaleLowerCase('de'));
    if (game) {
      game.claimWindow = radar.psplusText || null;
      game.monthLabel = radar.psplusLabel || null;
    }
  }

  const enriched = games.map(game => {
    const info = radar?.gameDetails?.[game.title] || {};
    return {
      ...game,
      description: info.description || null,
      genre: info.genre || null,
      developer: info.developer || null,
      publisher: info.publisher || null,
      trailerUrl: info.trailerUrl || null,
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
    sections,
    checkedAt: catalog?.checkedAt || null,
    sourceUrl: catalog?.sourceUrl,
    errors: catalog?.errors || []
  };
}

export { catalogFilter };
