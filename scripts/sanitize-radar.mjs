import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));

const berlinDate = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric'
}).format(new Date());

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 PlayStation-Radar/1.0',
      'accept-language': 'de-DE,de;q=0.9,en;q=0.7'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function strip(s='') {
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&amp;|&#038;/g,'&')
    .replace(/&euro;|&#8364;/g,'€')
    .replace(/&#8217;/g,'’')
    .replace(/\s+/g,' ')
    .trim();
}

function money(raw) { return raw.replace('.', ',') + ' €'; }

function parsePrimarySale(html, title) {
  const text = strip(html);
  const at = text.toLowerCase().indexOf(title.toLowerCase());
  if (at < 0) throw new Error(`Titel nicht gefunden: ${title}`);
  const editionAt = text.indexOf('Editionen:', at);
  const chunk = text.slice(at, editionAt > at ? editionAt : at + 3500);
  const m = chunk.match(/€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)\s*Preisnachlass gegenüber dem Originalpreis von\s*€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)/i);
  const d = chunk.match(/Spare\s+(\d{1,2})\s*%/i);
  if (!m || !d) throw new Error(`Kein aktives eindeutig parsebares Angebot: ${title}`);
  const current = Number(m[1].replace('.', '').replace(',', '.'));
  const original = Number(m[2].replace('.', '').replace(',', '.'));
  const pct = Number(d[1]);
  const expected = Math.round((1 - current / original) * 100);
  if (!(current > 0 && original > current) || Math.abs(expected - pct) > 2) {
    throw new Error(`Preisvalidierung fehlgeschlagen: ${title} ${current}/${original}/${pct}%`);
  }
  return { price: money(m[1]), oldPrice: money(m[2]), discount: `-${pct} %` };
}

function parseReleaseList(html) {
  const out = [];

  for (const m of html.matchAll(/<li[^>]*>\s*([0-3]?\d)\.\s*September:\s*([\s\S]*?)<\/li>/gi)) {
    const day = Number(m[1]);
    const title = strip(m[2]);
    if (day && title && title.length < 100) out.push({ date: `${String(day).padStart(2,'0')}.09.`, title });
  }

  if (out.length < 8) {
    for (const h of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
      const title = strip(h[1]);
      if (!title || /Schlusswort|September-Highlights|PS5-Spiele September/i.test(title)) continue;
      const after = html.slice((h.index ?? 0) + h[0].length, (h.index ?? 0) + h[0].length + 1800);
      const dm = strip(after).match(/Release:\s*([0-3]?\d)\.\s*September\s*2026/i);
      if (dm) out.push({ date: `${String(Number(dm[1])).padStart(2,'0')}.09.`, title });
    }
  }

  return out.filter((x,i,a)=>a.findIndex(y=>y.date===x.date && y.title.toLowerCase()===x.title.toLowerCase())===i)
    .sort((a,b)=>Number(a.date.slice(0,2))-Number(b.date.slice(0,2)));
}

function normalizeMeta(dateKey, metaKey) {
  if (!radar[dateKey] || radar[dateKey] === berlinDate || !radar[metaKey]) return;
  radar[metaKey] = radar[metaKey]
    .replace(/^Heute neu auf PS5\s*·\s*/i, 'PS5 · ')
    .replace(/^Seit\s+\d{2}\.\d{2}\.\s+auf PS5\s*·\s*/i, 'PS5 · ');
}

const problems = [];

try {
  const html = await get(sources.monthlyReleases);
  const schedule = parseReleaseList(html);
  if (schedule.length < 8) throw new Error(`nur ${schedule.length} Release-Einträge erkannt`);
  const todayDay = Number(berlinDate.slice(0,2));
  radar.releases = schedule.filter(x=>Number(x.date.slice(0,2)) >= todayDay).slice(0,5);
} catch (e) {
  problems.push(`Releases: ${e.message}`);
}

for (const source of sources.storeDeals || []) {
  try {
    const html = await get(source.url);
    const parsed = parsePrimarySale(html, source.title);
    const target = radar.deals.find(x=>x.title===source.title);
    if (!target) throw new Error('Deal-Karte fehlt in radar.json');
    Object.assign(target, parsed);
  } catch (e) {
    problems.push(`Store ${source.title}: ${e.message}`);
  }
}

normalizeMeta('leadDate','leadMeta');
normalizeMeta('secondary1Date','secondary1Meta');
normalizeMeta('secondary2Date','secondary2Meta');

if (problems.length) {
  radar.health = { ...(radar.health||{}), status:'warning', warnings:problems.length };
  radar.sourceCheck = { ...(radar.sourceCheck||{}), errors:[...(radar.sourceCheck?.errors||[]), ...problems] };
  await fs.writeFile(radarPath, JSON.stringify(radar,null,2)+'\n');
  console.error(problems.join('\n'));
  process.exit(1);
}

await fs.writeFile(radarPath, JSON.stringify(radar,null,2)+'\n');
console.log('Radar safety validation passed.');
