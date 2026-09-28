import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const statePath = new URL('../data/source-state.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
let state = {};
try { state = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch {}

const now = new Date();
const berlinIso = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(now);
const berlinDisplay = berlinIso.split('-').reverse().join('.');
const [todayYear, todayMonth, todayDay] = berlinIso.split('-').map(Number);
const errors = [];
let staleRelativeCopyFixed = 0;

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function sameBerlinDay(value) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(parsed) === berlinIso;
}

function cleanStaleRelativeCopy(dateKey, titleKey, metaKey) {
  const date = normalizeDate(radar[dateKey]);
  if (!date || date >= berlinIso) return;
  const short = `${date.slice(8)}.${date.slice(5, 7)}.`;
  if (typeof radar[titleKey] === 'string' && /\bheute\b/i.test(radar[titleKey])) {
    radar[titleKey] = radar[titleKey]
      .replace(/\bheute\s+/ig, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    staleRelativeCopyFixed += 1;
  }
  if (typeof radar[metaKey] === 'string') {
    const before = radar[metaKey];
    radar[metaKey] = radar[metaKey]
      .replace(/\bab sofort\b/ig, `seit ${short}`)
      .replace(/^Heute neu auf PS5\s*·\s*/i, 'PS5 · ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (radar[metaKey] !== before) staleRelativeCopyFixed += 1;
  }
}

for (const prefix of ['lead', 'secondary1', 'secondary2']) {
  cleanStaleRelativeCopy(`${prefix}Date`, `${prefix}Title`, `${prefix}Meta`);
}

const todayPosts = (state.playstationBlog?.newPosts || []).filter((post) => sameBerlinDay(post.pubDate));
const editorial = Array.isArray(radar.editorial) ? radar.editorial : [];
const editorialTitles = new Set(editorial.map((item) => item.title));
for (const post of todayPosts) {
  if (!editorialTitles.has(post.title)) errors.push(`Top-News: heutige Meldung fehlt im Editorial: ${post.title}`);
}
if (todayPosts.length !== editorial.length) {
  errors.push(`Top-News: ${todayPosts.length} heutige Feed-Meldung(en), aber ${editorial.length} Editorial-Eintrag/-Einträge`);
}

if (radar.date !== berlinDisplay) errors.push(`Ausgabedatum ${radar.date || 'fehlt'} entspricht nicht Europe/Berlin ${berlinDisplay}`);
if (todayPosts.length > 0) {
  const expected = `${todayPosts.length} NEUE PLAYSTATION-${todayPosts.length === 1 ? 'MELDUNG' : 'MELDUNGEN'}`;
  if (radar.newHeadline !== expected) radar.newHeadline = expected;
} else if (/\d+\s+NEUE PLAYSTATION-MELDUNG/.test(String(radar.newHeadline || ''))) {
  radar.newHeadline = 'HEUTE KEINE NEUE PLAYSTATION-MELDUNG';
}
radar.newCount = `${berlinDisplay.slice(0, 5)} · LIVE`;

const seenPlus = new Set();
for (const game of radar.plusGames || []) {
  const key = String(game.title || '').toLocaleLowerCase('de');
  if (!key || seenPlus.has(key)) errors.push(`PS Plus: doppelter oder leerer Titel ${game.title || '(leer)'}`);
  seenPlus.add(key);
  if (!/^https:\/\/store\.playstation\.com\//.test(String(game.storeUrl || ''))) errors.push(`PS Plus: keine offizielle Store-Identität für ${game.title}`);
  if (!/^https:\/\/image\.api\.playstation\.com\//.test(String(game.image || ''))) errors.push(`PS Plus: kein verifiziertes Produktcover für ${game.title}`);
}

const parsedCandidates = state.psPlusMonthly?.parsed?.games || [];
const acceptedTitles = new Set((radar.plusGames || []).map((game) => String(game.title || '').toLocaleLowerCase('de')));
if (state.psPlusMonthly) {
  state.psPlusMonthly.candidateAudit = {
    checkedAt: now.toISOString(),
    parsed: parsedCandidates.length,
    accepted: parsedCandidates.filter((game) => acceptedTitles.has(String(game.title || '').toLocaleLowerCase('de'))).map((game) => game.title),
    rejected: parsedCandidates.filter((game) => !acceptedTitles.has(String(game.title || '').toLocaleLowerCase('de'))).map((game) => game.title)
  };
}

for (const release of radar.releases || []) {
  const match = String(release.date || '').match(/^(\d{2})\.(\d{2})\.$/);
  if (!match) { errors.push(`Release: ungültiges Datum für ${release.title || '(ohne Titel)'}`); continue; }
  let year = todayYear;
  const month = Number(match[2]);
  if (month < todayMonth - 6) year += 1;
  const key = year * 10000 + month * 100 + Number(match[1]);
  const todayKey = todayYear * 10000 + todayMonth * 100 + todayDay;
  if (key < todayKey) errors.push(`Release: vergangener Termin wird als kommend geführt: ${release.title} ${release.date}`);
}

radar.temporalCheck = {
  status: errors.length ? 'warning' : 'ok',
  checkedAt: now.toISOString(),
  berlinDate: berlinIso,
  newPostsToday: todayPosts.length,
  staleRelativeCopyFixed,
  errors
};

await fs.writeFile(radarPath, JSON.stringify(radar, null, 2) + '\n');
await fs.writeFile(statePath, JSON.stringify(state, null, 2) + '\n');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Temporal semantics: ok; today=${todayPosts.length}; stale-copy-fixed=${staleRelativeCopyFixed}; PS+ candidates=${parsedCandidates.length}.`);
