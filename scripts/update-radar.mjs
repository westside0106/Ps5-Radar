import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const statePath = new URL('../data/source-state.json', import.meta.url);
const archiveDir = new URL('../data/archive/', import.meta.url);
const archiveIndexPath = new URL('../data/archive/index.json', import.meta.url);

const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));
let oldState = {};
try { oldState = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch {}

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTH_INDEX = Object.fromEntries(MONTHS.map((name, index) => [name.toLowerCase(), index + 1]));
const now = new Date();
const berlinDate = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric'
}).format(now);
const [todayDay, todayMonth, todayYear] = berlinDate.split('.').map(Number);

async function archiveCurrentIssue() {
  await fs.mkdir(archiveDir, { recursive: true });
  let index = [];
  try { index = JSON.parse(await fs.readFile(archiveIndexPath, 'utf8')); } catch {}

  const match = String(radar.edition || '').match(/#(\d+)/);
  const n = match ? Number(match[1]) : 1;
  const id = String(n).padStart(3, '0');

  if (!index.some((item) => item.id === id)) {
    await fs.writeFile(new URL(`${id}.json`, archiveDir), JSON.stringify(radar, null, 2) + '\n');
    index.unshift({
      id,
      edition: `AUSGABE #${id}`,
      date: radar.date,
      headline: radar.newHeadline,
      lead: radar.leadTitle,
      file: `${id}.json`
    });
    await fs.writeFile(archiveIndexPath, JSON.stringify(index, null, 2) + '\n');
  }

  if (!index.some((item) => item.date === berlinDate) && radar.date !== berlinDate) {
    radar.edition = `AUSGABE #${String(n + 1).padStart(3, '0')}`;
  }
}
await archiveCurrentIssue();

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 PlayStation-Radar/3.0',
      'accept-language': 'de-DE,de;q=0.9,en;q=0.7',
      accept: 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { text: await res.text(), url: res.url };
}

function strip(value = '') {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;|&#038;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–')
    .replace(/&euro;|&#8364;/g, '€')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstItems(xml, limit = 15) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit).map((match) => {
    const item = match[1];
    return {
      title: strip(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),
      link: strip(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]),
      pubDate: strip(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1])
    };
  }).filter((item) => item.title && item.link);
}

function classify(title = '') {
  const text = title.toLowerCase();
  if (/playstation plus|ps plus|spielekatalog|monatliche spiele/.test(text)) return 'psplus';
  if (/angebot|rabatt|sale|store/.test(text)) return 'store';
  if (/erscheint|release|veröffentlich|launch|ab heute|jetzt erhältlich/.test(text)) return 'release';
  return 'news';
}

function scorePost(post) {
  const base = { release: 100, psplus: 85, store: 70, news: 50 }[post.category] || 40;
  const text = post.title.toLowerCase();
  return base
    + (/ps5|playstation 5/.test(text) ? 15 : 0)
    + (/demo|trial|kostenlos|gratis/.test(text) ? 8 : 0)
    + (/update|trailer/.test(text) ? 3 : 0);
}

function sameDay(dateString, target) {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(date) === target;
}

function monthNum(name) {
  const month = MONTH_INDEX[String(name || '').toLowerCase()];
  return month ? String(month).padStart(2, '0') : '';
}

function euroValues(html) {
  const values = [...strip(html).matchAll(/(?:€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)|([0-9]{1,3}(?:[.,][0-9]{2})?)\s*€)/g)]
    .map((match) => (match[1] || match[2]).replace('.', ',') + ' €');
  return [...new Set(values)];
}

function percentValues(html) {
  return [...new Set([...strip(html).matchAll(/(?:-|Spare\s*)?(\d{1,2})\s*%/gi)].map((match) => `-${match[1]} %`))];
}

function parseStore(html, title) {
  const text = strip(html);
  const prices = euroValues(html);
  const discounts = percentValues(html);
  const titleAt = text.toLowerCase().indexOf(title.toLowerCase());
  const slice = titleAt >= 0 ? text.slice(Math.max(0, titleAt - 500), titleAt + 2500) : text.slice(0, 5000);
  return {
    prices: euroValues(slice).length ? euroValues(slice) : prices,
    discounts: percentValues(slice).length ? percentValues(slice) : discounts
  };
}

function updateDealFromParsed(deal, parsed) {
  if (!parsed?.prices?.length) return false;
  const numbers = parsed.prices.map((value) => ({
    string: value,
    number: Number(value.replace(' €', '').replace('.', '').replace(',', '.'))
  })).filter((item) => Number.isFinite(item.number));
  if (!numbers.length) return false;
  numbers.sort((a, b) => a.number - b.number);
  const low = numbers[0];
  const high = numbers.at(-1);
  if (low.number > 0) deal.price = low.string;
  if (high.number > low.number) deal.oldPrice = high.string;
  if (parsed.discounts?.[0]) deal.discount = parsed.discounts[0];
  return true;
}

function parseReleaseSchedule(html) {
  const monthPattern = MONTHS.join('|');
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  const out = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const title = strip(heading[1]);
    if (!title || /schlusswort|highlights|playstation store|spotlight|playstation plus/i.test(title)) continue;
    const sectionEnd = headings[index + 1]?.index ?? Math.min(html.length, (heading.index || 0) + 20000);
    const section = strip(html.slice((heading.index || 0) + heading[0].length, sectionEnd));
    const match = section.match(new RegExp(`Release:\\s*(\\d{1,2})\\.\\s*(${monthPattern})\\s*(20\\d{2})?`, 'i'));
    if (!match) continue;
    const month = MONTH_INDEX[match[2].toLowerCase()];
    let year = match[3] ? Number(match[3]) : todayYear;
    if (!match[3] && month < todayMonth - 6) year += 1;
    out.push({
      date: `${String(Number(match[1])).padStart(2, '0')}.${String(month).padStart(2, '0')}.`,
      title,
      year
    });
  }

  return out.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.title.toLowerCase() === item.title.toLowerCase()) === index
  ).sort((a, b) => {
    const aKey = a.year * 10000 + Number(a.date.slice(3, 5)) * 100 + Number(a.date.slice(0, 2));
    const bKey = b.year * 10000 + Number(b.date.slice(3, 5)) * 100 + Number(b.date.slice(0, 2));
    return aKey - bKey;
  });
}

function decodeUrl(value = '') {
  return value.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
}

function nearbyImage(html, position) {
  const start = Math.max(0, position - 5000);
  const end = Math.min(html.length, position + 5000);
  const chunk = html.slice(start, end);
  const urls = [...chunk.matchAll(/(?:src|data-src|content)=["'](https?:[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)]
    .map((match) => decodeUrl(match[1]))
    .filter((url) => /playstation|sie|wp-content|tachyon|image\.api/i.test(url));
  if (!urls.length) return null;
  return urls.sort((a, b) =>
    Math.abs(chunk.indexOf(a) - (position - start)) - Math.abs(chunk.indexOf(b) - (position - start))
  )[0];
}

function parsePsPlus(html) {
  const text = strip(html);
  const headings = [...html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)];
  const games = [];
  const monthPattern = MONTHS.join('|');

  for (const heading of headings) {
    const raw = strip(heading[1]);
    const title = raw.replace(/\s*[|–-]\s*PS[45](?:\s*[/,]\s*PS[45])?.*$/i, '').trim();
    if (!/\bPS[45]\b/i.test(raw)) continue;
    if (new RegExp(`PlayStation Plus|monatliche Spiele|Spielekatalog|${monthPattern}`, 'i').test(title)) continue;
    if (title.length < 2 || title.length > 90) continue;
    games.push({ title, image: nearbyImage(html, heading.index ?? 0) });
  }

  const unique = games.filter((game, index, all) =>
    all.findIndex((candidate) => candidate.title.toLowerCase() === game.title.toLowerCase()) === index
  ).slice(0, 6);

  const range = text.match(new RegExp(`(?:ab|vom|von)\\s+(\\d{1,2})\\.\\s*(${monthPattern})[\\s\\S]{0,150}?(?:bis|zum)\\s+(\\d{1,2})\\.\\s*(${monthPattern})`, 'i'));
  const month = text.match(new RegExp(`monatliche Spiele für\\s+(${monthPattern})\\s+(20\\d{2})`, 'i'))
    || text.match(new RegExp(`PlayStation Plus[^.]{0,80}\\b(${monthPattern})\\s+(20\\d{2})`, 'i'));

  return {
    games: unique,
    range: range ? {
      fromDay: Number(range[1]), fromMonth: range[2],
      toDay: Number(range[3]), toMonth: range[4]
    } : null,
    label: month ? `${month[1].toUpperCase()} ${month[2]}` : null
  };
}

function applyPsPlus(parsed) {
  if (!parsed?.games || parsed.games.length < 3) return false;
  const oldImages = new Map((radar.plusGames || []).map((game) => [game.title.toLowerCase(), game.image]));
  const usable = parsed.games.map((game) => ({
    title: game.title,
    image: game.image || oldImages.get(game.title.toLowerCase()) || null
  })).filter((game) => game.image);
  if (usable.length < 3) return false;

  radar.plusGames = usable.slice(0, 4);
  const prettyMonth = parsed.label ? parsed.label.split(' ')[0] : null;
  radar.psplusTitle = `${prettyMonth ? prettyMonth[0] + prettyMonth.slice(1).toLowerCase() : 'Aktuelle'}-Spiele sind live`;
  if (parsed.range) radar.psplusText = `Verfügbar bis ${String(parsed.range.toDay).padStart(2, '0')}.${monthNum(parsed.range.toMonth)}.`;
  if (parsed.label) radar.psplusLabel = parsed.label;
  return true;
}

function parseEA(html) {
  const text = strip(html);
  const monthPattern = MONTHS.join('|');
  const trial = text.match(new RegExp(`(?:10[- ]?stündige|10\\s*Stunden|10h)[^.!?]{0,140}?(?:ab\\s+dem\\s+|ab\\s+)?(\\d{1,2})\\.\\s*(${monthPattern})`, 'i'));
  const game = text.match(/EA SPORTS FC[^.!?]{0,20}?\d{2}/i)?.[0] || 'EA Play';
  const items = [];
  if (/10\s*%/.test(text)) items.push('10 % auf digitale EA-Käufe');
  if (/Mitgliederbelohnungen|monatliche Boni/i.test(text)) items.push('Monatliche Mitgliederbelohnungen');
  if (/The Play List/i.test(text)) items.push('The Play List');
  return { game, trial, items };
}

function applyEA(parsed) {
  if (!parsed) return false;
  if (parsed.trial) {
    const shortGame = parsed.game.replace(/^EA SPORTS\s*/i, '').trim();
    radar.eaTitle = `${shortGame} · 10h Trial ab ${String(parsed.trial[1]).padStart(2, '0')}.${monthNum(parsed.trial[2])}.`;
    radar.benefitsText = `EA Play: ${radar.eaTitle}${parsed.items.length ? `; ${parsed.items.join('; ')}.` : '.'}`;
  }
  if (parsed.items.length) radar.eaItems = parsed.items;
  return Boolean(parsed.trial || parsed.items.length);
}

function parseUbisoft(html) {
  const text = strip(html);
  const price = euroValues(html)[0] || null;
  return {
    price,
    classics: /Ubisoft\+ Classics/i.test(text),
    extra: /PS Plus Extra|PlayStation Plus Extra/i.test(text),
    premium: /PS Plus Premium|PlayStation Plus Premium/i.test(text)
  };
}

function applyUbisoft(parsed, psText = '') {
  const merged = {
    ...parsed,
    extra: parsed.extra || (/Ubisoft\+ Classics/i.test(psText) && /Extra/i.test(psText)),
    premium: parsed.premium || (/Ubisoft\+ Classics/i.test(psText) && /Premium/i.test(psText))
  };
  if (!merged.classics && !/Ubisoft\+ Classics/i.test(psText)) return false;
  radar.ubisoftTitle = 'Ubisoft+ Classics';
  radar.ubisoftText = `Auf PlayStation als Ubisoft+ Classics verfügbar${merged.price ? ` · ${merged.price}/Monat` : ''}${merged.extra || merged.premium ? '; zudem über PS Plus Extra/Premium' : ''}.`;
  radar.ubisoftItems = ['Ubisoft+ Classics', merged.extra ? 'PS Plus Extra' : null, merged.premium ? 'PS Plus Premium' : null].filter(Boolean);
  return true;
}

const checks = {};
const errors = [];
let newPosts = [];
let psWhatsNew = '';

try {
  const feed = await get(sources.playstationBlogFeed);
  const posts = firstItems(feed.text);
  checks.playstationBlog = { ok: true, posts };
  const previous = new Set(oldState.playstationBlog?.posts?.map((item) => item.link) || []);
  newPosts = posts.filter((item) => !previous.has(item.link)).map((item) => ({ ...item, category: classify(item.title) }));
  checks.playstationBlog.newPosts = newPosts;
  radar.sourceAlerts = newPosts.slice(0, 5).map((item) => ({
    title: item.title, url: item.link, source: 'PlayStation Blog DE', category: item.category
  }));
} catch (error) {
  errors.push(`PlayStation Blog: ${error.message}`);
  checks.playstationBlog = { ok: false };
}

try {
  const body = await get(sources.monthlyReleases);
  const schedule = parseReleaseSchedule(body.text);
  checks.monthlyReleases = { ok: true, bytes: body.text.length, schedule };
  if (schedule.length >= 3) {
    const todayKey = todayYear * 10000 + todayMonth * 100 + todayDay;
    const future = schedule.filter((item) => {
      const key = item.year * 10000 + Number(item.date.slice(3, 5)) * 100 + Number(item.date.slice(0, 2));
      return key >= todayKey;
    }).slice(0, 5);
    if (future.length) radar.releases = future.map(({ date, title }) => ({ date, title }));
  }
} catch (error) {
  errors.push(`monthlyReleases: ${error.message}`);
  checks.monthlyReleases = { ok: false };
}

try {
  const body = await get(sources.psPlusMonthly);
  const parsed = parsePsPlus(body.text);
  const updated = applyPsPlus(parsed);
  checks.psPlusMonthly = {
    ok: true,
    bytes: body.text.length,
    updated,
    parsed: { ...parsed, games: parsed.games.map((game) => ({ title: game.title, hasImage: Boolean(game.image) })) }
  };
} catch (error) {
  errors.push(`psPlusMonthly: ${error.message}`);
  checks.psPlusMonthly = { ok: false };
}

try {
  const body = await get(sources.psPlusWhatsNew);
  psWhatsNew = body.text;
  checks.psPlusWhatsNew = { ok: true, bytes: body.text.length };
} catch (error) {
  errors.push(`psPlusWhatsNew: ${error.message}`);
  checks.psPlusWhatsNew = { ok: false };
}

try {
  let source = sources.eaPlay;
  let body;
  try {
    body = await get(source);
  } catch (primaryError) {
    if (!sources.eaPlayGeneral) throw primaryError;
    source = sources.eaPlayGeneral;
    body = await get(source);
  }
  const parsed = parseEA(body.text);
  const updated = applyEA(parsed);
  checks.eaPlay = {
    ok: true,
    source: body.url || source,
    bytes: body.text.length,
    updated,
    parsed: { trial: Boolean(parsed.trial), items: parsed.items }
  };
} catch (error) {
  errors.push(`eaPlay: ${error.message}`);
  checks.eaPlay = { ok: false };
}

try {
  const body = await get(sources.ubisoftPlus);
  const parsed = parseUbisoft(body.text);
  const updated = applyUbisoft(parsed, strip(psWhatsNew));
  checks.ubisoftPlus = { ok: true, bytes: body.text.length, updated, parsed };
} catch (error) {
  errors.push(`ubisoftPlus: ${error.message}`);
  checks.ubisoftPlus = { ok: false };
}

checks.storeDeals = [];
for (const source of sources.storeDeals || []) {
  try {
    const body = await get(source.url);
    const parsed = parseStore(body.text, source.title);
    const target = (radar.deals || []).find((item) => item.title === source.title);
    const updated = target ? updateDealFromParsed(target, parsed) : false;
    checks.storeDeals.push({ title: source.title, ok: true, updated, parsed });
  } catch (error) {
    errors.push(`${source.title}: ${error.message}`);
    checks.storeDeals.push({ title: source.title, ok: false });
  }
}

const todayPosts = newPosts.filter((item) => sameDay(item.pubDate, berlinDate)).sort((a, b) => scorePost(b) - scorePost(a));
const releasePosts = todayPosts.filter((item) => item.category === 'release');
if (releasePosts.length) radar.newHeadline = `${releasePosts.length} RELEASE${releasePosts.length === 1 ? '' : 'S'} HEUTE`;
else if (todayPosts.length) radar.newHeadline = `${todayPosts.length} NEUE PLAYSTATION-MELDUNG${todayPosts.length === 1 ? '' : 'EN'}`;
else radar.newHeadline = 'RADAR-CHECK AKTUELL';

radar.quickItems = [
  ...todayPosts.slice(0, 2).map((item) => item.title),
  radar.psplusTitle,
  radar.eaTitle || radar.storeTitle
].filter(Boolean).slice(0, 4);
radar.editorial = todayPosts.slice(0, 5).map((item) => ({
  title: item.title, url: item.link, category: item.category, score: scorePost(item)
}));
radar.date = berlinDate;
radar.newCount = `${berlinDate.slice(0, 5)} · LIVE`;

const sourceResults = [
  { name: 'PlayStation Blog', ...checks.playstationBlog },
  { name: 'Monats-Releases', ...checks.monthlyReleases },
  { name: 'PS Plus monatlich', ...checks.psPlusMonthly },
  { name: 'PS Plus aktuell', ...checks.psPlusWhatsNew },
  { name: 'EA Play', ...checks.eaPlay },
  { name: 'Ubisoft+', ...checks.ubisoftPlus },
  ...(checks.storeDeals || []).map((item) => ({ name: `Store: ${item.title}`, ...item }))
];
const totalSources = sourceResults.length;
const okCount = sourceResults.filter((item) => item.ok).length;
const failedCount = totalSources - okCount;
const warningCount = errors.length;

radar.health = {
  status: warningCount ? 'warning' : 'ok',
  checkedAt: now.toISOString(),
  okSources: okCount,
  totalSources,
  failedSources: failedCount,
  warnings: warningCount,
  lastSuccessfulCheck: warningCount ? (radar.health?.lastSuccessfulCheck || null) : now.toISOString()
};
radar.radarCheck = warningCount
  ? `Stand ${berlinDate} · ${okCount}/${totalSources} Quellen · ${warningCount} Warnung(en)`
  : `Stand ${berlinDate} · ${okCount}/${totalSources} Quellen erfolgreich geprüft`;
radar.sourceCheck = { checkedAt: now.toISOString(), errors, sources: sourceResults.map(({ name, ok }) => ({ name, ok: Boolean(ok) })) };

await fs.writeFile(radarPath, JSON.stringify(radar, null, 2) + '\n');
await fs.writeFile(statePath, JSON.stringify({ checkedAt: now.toISOString(), ...checks }, null, 2) + '\n');
console.log(`Radar checked for ${berlinDate}. ${todayPosts.length} new post(s), ${warningCount} warning(s), ${okCount}/${totalSources} sources ok.`);
if (errors.length) console.log(errors.join('\n'));
