import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const catalogPath = new URL('../data/game-sources.json', import.meta.url);

const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));

const checkedAt = new Date().toISOString();
const warnings = [];

function decodeEntities(value = '') {
  return value
    .replace(/&amp;|&#038;/g, '&')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&euro;|&#8364;/g, '€')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function strip(html = '') {
  return decodeEntities(html)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(value) {
  if (!value) return null;
  const out = decodeEntities(String(value)).replace(/\s+/g, ' ').trim();
  return out || null;
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'));
  if (a?.[1]) return clean(a[1]);
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i'));
  return clean(b?.[1]);
}

function field(text, label) {
  const stop = '(?:Plattform|Veröffentlichung|Herausgeber|Genres|Stimme|Bildschirmsprachen|Bewertungen|Editionen|Untertitel|Steuerelemente|Barrierefreiheitsfunktionen)';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${escaped}:\\s*(.{1,240}?)(?=\\s+${stop}:|$)`, 'i'));
  return clean(match?.[1]);
}

function compactDescription(value) {
  const text = clean(value);
  if (!text) return null;
  return text.length > 520 ? `${text.slice(0, 517).trimEnd()}…` : text;
}

function descriptionFromText(text, title) {
  const markers = [`Was ist ${title}?`, `Was ist ${title.replace(/™|®/g, '').trim()}?`];
  for (const marker of markers) {
    const pos = text.toLowerCase().indexOf(marker.toLowerCase());
    if (pos < 0) continue;
    let chunk = text.slice(pos + marker.length, pos + marker.length + 1200);
    chunk = chunk.split(/\s+(?:Hauptfeatures|Haupt-Features|Bewertungen und Rezensionen|Editionen|In Aktion ansehen|Warum du|Features)\b/i)[0];
    const cleaned = compactDescription(chunk);
    if (cleaned && cleaned.length > 40) return cleaned;
  }
  return null;
}

function platformFromText(text) {
  const explicit = field(text, 'Plattform');
  if (explicit) return explicit.replace(/\s*,\s*/g, ' · ');
  const head = text.slice(0, 1800);
  const found = [];
  if (/\bPS5\b/i.test(head)) found.push('PS5');
  if (/\bPS4\b/i.test(head)) found.push('PS4');
  return found.length ? found.join(' · ') : null;
}

function psPlusStatus(text, seedStatus) {
  if (seedStatus) return seedStatus;
  if (/In PlayStation\s*Plus enthalten/i.test(text)) return 'In PlayStation Plus enthalten';
  if (/PlayStation Plus Extra abonnieren/i.test(text)) return 'Im PS Plus Extra-Spielekatalog';
  if (/PS Plus Premium[^.]{0,100}Spieltestversion|Spieltestversion[^.]{0,100}PS Plus Premium/i.test(text)) return 'PS Plus Premium: Spieltestversion';
  return null;
}

function parsePage(html, title, seed) {
  const text = strip(html);
  const parsed = {
    description: compactDescription(metaContent(html, 'og:description') || metaContent(html, 'description') || descriptionFromText(text, title)),
    publisher: field(text, 'Herausgeber'),
    genre: field(text, 'Genres'),
    release: field(text, 'Veröffentlichung'),
    platform: platformFromText(text),
    psPlusStatus: psPlusStatus(text, seed.psPlusStatus),
  };
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value));
}

async function get(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 PlayStation-Radar/1.0',
      'accept-language': 'de-DE,de;q=0.9,en;q=0.7',
      accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function storeUrlFor(title) {
  return (sources.storeDeals || []).find((item) => item.title === title)?.url || null;
}

const titles = new Set([
  radar.leadTitle,
  radar.secondary1Title,
  radar.secondary2Title,
  ...(radar.plusGames || []).map((item) => item.title),
  ...(radar.deals || []).map((item) => item.title),
  ...(radar.releases || []).map((item) => item.title),
]);
if (radar.eaTitle) titles.add('EA SPORTS FC 27');

titles.delete(undefined);
titles.delete(null);
titles.delete('');

const existing = radar.gameDetails || {};
const gameDetails = {};
let fetched = 0;
let enriched = 0;

for (const title of titles) {
  const seed = catalog[title] || {};
  const pageUrl = seed.pageUrl || seed.storeUrl || storeUrlFor(title) || null;
  let parsed = {};

  if (pageUrl) {
    try {
      const html = await get(pageUrl);
      parsed = parsePage(html, title, seed);
      fetched += 1;
    } catch (error) {
      warnings.push(`${title}: ${error.message}`);
    }
  }

  const previous = existing[title] || {};
  const merged = {
    ...previous,
    ...parsed,
    ...seed,
    pageUrl: seed.pageUrl || previous.pageUrl || (pageUrl && !pageUrl.includes('store.playstation.com') ? pageUrl : null),
    storeUrl: storeUrlFor(title) || seed.storeUrl || previous.storeUrl || (pageUrl?.includes('store.playstation.com') ? pageUrl : null),
    trailerUrl: seed.trailerUrl || previous.trailerUrl || null,
    developer: seed.developer || previous.developer || null,
    description: seed.description || parsed.description || previous.description || null,
    genre: seed.genre || parsed.genre || previous.genre || null,
    platform: seed.platform || parsed.platform || previous.platform || null,
    publisher: seed.publisher || parsed.publisher || previous.publisher || null,
    release: seed.release || parsed.release || previous.release || null,
    psPlusStatus: seed.psPlusStatus || parsed.psPlusStatus || previous.psPlusStatus || null,
  };

  const releaseItem = (radar.releases || []).find((item) => item.title === title);
  if (releaseItem) {
    const year = radar.date?.slice(-4) || String(new Date().getFullYear());
    merged.release = `${releaseItem.date}${year}`;
  }

  if ((radar.plusGames || []).some((item) => item.title === title)) {
    merged.psPlusStatus = `${radar.psplusLabel || 'Aktuell'} · ${radar.psplusText || 'In PlayStation Plus enthalten'}`;
  }

  gameDetails[title] = Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
  if (Object.keys(gameDetails[title]).length) enriched += 1;
}

radar.gameDetails = gameDetails;
radar.enrichment = {
  checkedAt,
  titles: titles.size,
  fetched,
  enriched,
  warnings,
};

await fs.writeFile(radarPath, JSON.stringify(radar, null, 2) + '\n');
console.log(`Radar detail enrichment complete: ${enriched}/${titles.size} titles enriched, ${warnings.length} warnings.`);
