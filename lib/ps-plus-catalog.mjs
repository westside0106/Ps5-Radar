export const CATALOG_SOURCE = 'https://www.playstation.com/de-de/ps-plus/games/';
export const SERVICES = ['essential', 'extra', 'premium', 'ubisoft', 'trials', 'leaving'];
export const CATALOG_CATEGORIES = { essential: 'Monatliche Spiele', extra: 'Spielekatalog', classics: 'Klassikerkatalog', ubisoft: 'Ubisoft+ Classics' };
export function titleKey(value = '') {
  return String(value).replace(/[™®©]/g, '').normalize('NFKD').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function storeIdentity(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'store.playstation.com') return null;
    const match = url.pathname.match(/^\/(?:[a-z]{2}-[a-z]{2}\/)?(concept|product)\/([^/?#]+)/i);
    return match ? `${match[1].toLowerCase()}:${match[2].toUpperCase()}` : null;
  } catch { return null; }
}
export function verifiedImage(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (!['image.api.playstation.com', 'gmedia.playstation.com'].includes(url.hostname.toLowerCase())) return null;
    if (!/\.(?:png|jpe?g|webp)$/i.test(url.pathname) && !url.pathname.includes('/is/image/')) return null;
    return url.href;
  } catch { return null; }
}
export function emptyCatalog() {
  return { schemaVersion: 1, checkedAt: null, sourceUrl: CATALOG_SOURCE, sections: {}, games: [], errors: ['Noch kein gültiger Katalog-Snapshot vorhanden.'] };
}
const unique = values => [...new Set(values.filter(Boolean))];
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null;
export function normalizeCatalog(raw) {
  const games = new Map(), sections = {}, errors = [];
  const input = raw?.results || {};
  for (const service of Object.keys(CATALOG_CATEGORIES)) {
    const section = input[service];
    if (!section) { sections[service] = { complete: false, expected: null, count: 0 }; continue; }
    const entries = Array.isArray(section.entries) ? section.entries : [];
    const ids = new Set();
    let invalid = 0;
    for (const entry of entries) {
      const id = storeIdentity(entry.storeUrl);
      if (!id || !entry.title) { invalid++; continue; }
      ids.add(id);
      const previous = games.get(id) || { id, title: entry.title, storeUrl: entry.storeUrl, image: null, platforms: [], genres: [], services: [], sourceUrl: raw.sourceUrl || CATALOG_SOURCE };
      const membership = service === 'classics' ? 'premium' : service;
      const image = verifiedImage(entry.image);
      const platforms = unique([...(previous.platforms || []), ...(entry.platforms || [])].filter(p => ['PS4','PS5'].includes(p)));
      const genres = unique([...(previous.genres || []), ...(entry.genres || [])]);
      games.set(id, { ...previous, image: image || previous.image, platforms, genres, services: unique([...previous.services, membership]), ...Object.fromEntries(['releaseDate','addedAt','leavingAt'].filter(k => validDate(entry[k])).map(k => [k, entry[k]])), ...(Number.isFinite(entry.trialHours) && entry.trialHours > 0 ? {trialHours:entry.trialHours} : {}) });
    }
    const expected = Number.isInteger(section.expected) && section.expected >= 0 ? section.expected : null;
    // Die Quelle zaehlt Eintraege, nicht Produkte: mehrere Karten koennen
    // dieselbe Store-Identitaet tragen. Vollstaendigkeit heisst daher, alle
    // gelisteten Karten gesehen zu haben; count bleibt die Zahl der Produkte.
    const observed = Number.isInteger(section.observed) && section.observed >= 0 ? section.observed : ids.size;
    const duplicates = Math.max(0, observed - invalid - ids.size);
    const complete = section.complete === true && expected !== null && observed === expected && invalid === 0;
    sections[service] = { complete, expected, count: ids.size, invalid, duplicates };
    if (!complete) errors.push(`${service}: ${ids.size}/${expected ?? '?'} Einträge, ${invalid} ungültig`);
  }
  for (const game of games.values()) game.services.sort();
  return { schemaVersion: 1, checkedAt: raw.checkedAt || null, sourceUrl: raw.sourceUrl || CATALOG_SOURCE, sections, games: [...games.values()].sort((a,b) => a.title.localeCompare(b.title, 'de')), errors: unique([...(raw.errors || []), ...errors]) };
}
export function catalogCover(catalog, title, storeUrl = null) {
  const id = storeIdentity(storeUrl), key = titleKey(title);
  const candidates = (catalog?.games || []).filter(game => game.image && (id ? game.id === id : titleKey(game.title) === key));
  if (candidates.length !== 1) return null;
  if (key && titleKey(candidates[0].title) !== key) return null;
  return verifiedImage(candidates[0].image);
}
export function mergeRadarCatalog(catalog, radar) {
  const games = new Map((catalog?.games || []).map(game => [game.id, {...game, services: [...game.services]}]));
  const source = radar?.resolvedSources?.psPlusMonthly || null;
  const label = radar?.psplusLabel || '';
  const authoritativeEssential = catalog?.sections?.essential?.complete === true;
  for (const item of radar?.plusGames || []) {
    const storeUrl = item.storeUrl || radar?.resolvedSources?.psPlusStoreUrls?.[item.title] || radar?.gameDetails?.[item.title]?.storeUrl;
    const id = storeIdentity(storeUrl);
    if (!id) continue;
    if (authoritativeEssential && !games.has(id)) continue;
    const game = games.get(id) || { id, title: item.title, storeUrl, image: null, platforms: [], genres: [], services: [], sourceUrl: source };
    if (!authoritativeEssential && !game.services.includes('essential')) game.services.push('essential');
    if (!game.image) game.image = catalogCover(catalog, item.title, storeUrl);
    game.claimWindow = radar.psplusText || null;
    game.monthLabel = label;
    games.set(id, game);
  }
  return [...games.values()];
}
export function catalogStatus(catalog, service, now = new Date()) {
  const section = catalog?.sections?.[service === 'premium' ? 'classics' : service];
  const checkedAt = section?.checkedAt || catalog?.checkedAt;
  const ageHours = checkedAt ? (now.getTime() - new Date(checkedAt).getTime()) / 3600000 : Infinity;
  return { complete: Boolean(section?.complete), count: section?.count ?? 0, expected: section?.expected ?? null, checkedAt, stale: !Number.isFinite(ageHours) || ageHours > 48 || ageHours < -1 };
}
export function berlinDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
}
export function catalogFilter(games, { service = 'extra', query = '', platform = 'all', genre = 'all', sort = 'title', now = new Date() } = {}) {
  const key = titleKey(query), today = berlinDate(now);
  const result = games.filter(game => {
    const memberships = game.services || [];
    const allowed = service === 'leaving' ? Boolean(game.leavingAt && game.leavingAt >= today && memberships.some(s => ['extra','premium'].includes(s))) : memberships.includes(service);
    if (!allowed || (key && !titleKey(game.title).includes(key))) return false;
    if (platform !== 'all' && !game.platforms?.includes(platform)) return false;
    if (genre !== 'all' && !game.genres?.some(g => titleKey(g) === titleKey(genre))) return false;
    return true;
  });
  if (sort === 'recent') result.sort((a,b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')) || a.title.localeCompare(b.title,'de'));
  else if (sort === 'leaving') result.sort((a,b) => String(a.leavingAt || '9999').localeCompare(String(b.leavingAt || '9999')) || a.title.localeCompare(b.title,'de'));
  else result.sort((a,b) => a.title.localeCompare(b.title,'de'));
  return result;
}
export function mergeCatalogSnapshots(previous, next) {
  if (!previous?.games?.length) return next;
  const games = new Map(previous.games.map(game => [game.id, {...game, services:[...game.services]}]));
  for (const game of next.games || []) games.set(game.id, game);
  const sections = {...previous.sections};
  const successful = Object.entries(next.sections || {}).filter(([,s]) => s.complete).map(([name]) => name);
  for (const service of successful) {
    const oldName = service === 'classics' ? 'premium' : service;
    for (const [id,game] of games) {
      if (game.services.includes(oldName) && !(next.games || []).some(item => item.id === id && item.services.includes(oldName))) {
        game.services = game.services.filter(s => s !== oldName);
      }
    }
    sections[service] = {...next.sections[service], checkedAt: next.checkedAt};
  }
  for (const game of next.games || []) {
    const old = previous.games.find(item => item.id === game.id);
    if (old) games.set(game.id, {...old,...game,services:unique([...old.services.filter(s => !successful.includes(s === 'premium'?'classics':s)),...game.services])});
  }
  return {...next, sections, games:[...games.values()].filter(g => g.services.length), errors:unique([...(next.errors || [])]), lastAttemptAt:next.checkedAt, checkedAt:successful.length ? next.checkedAt : previous.checkedAt};
}
