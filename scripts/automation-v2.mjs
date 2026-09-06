import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTH_INDEX = Object.fromEntries(MONTHS.map((name, i) => [name.toLowerCase(), i + 1]));
const now = new Date();
const berlinParts = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric'
}).formatToParts(now);
const part = (type) => Number(berlinParts.find((x) => x.type === type)?.value);
const today = { day: part('day'), month: part('month'), year: part('year') };
const currentMonthName = MONTHS[today.month - 1];

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 PlayStation-Radar/2.0',
      'accept-language': 'de-DE,de;q=0.9,en;q=0.7',
      accept: 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { text: await res.text(), url: res.url };
}

function decode(s='') {
  return s.replace(/&amp;|&#038;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#8217;|&#39;/g,'’')
    .replace(/&#8211;/g,'–')
    .replace(/&nbsp;/g,' ')
    .replace(/&euro;|&#8364;/g,'€')
    .replace(/\\u0026/g,'&')
    .replace(/\\\//g,'/');
}

function strip(s='') {
  return decode(s)
    .replace(/<!\[CDATA\[|\]\]>/g,'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function rssItems(xml, limit=60) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit).map((m) => {
    const x = m[1];
    return {
      title: strip(x.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),
      link: strip(x.match(/<link>([\s\S]*?)<\/link>/i)?.[1]),
      pubDate: strip(x.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1])
    };
  }).filter((x) => x.title && x.link);
}

function monthNumber(name) {
  return MONTH_INDEX[String(name || '').toLowerCase()] || null;
}

function yearForMonth(month, explicitYear = null) {
  if (explicitYear) return Number(explicitYear);
  if (month < today.month - 6) return today.year + 1;
  if (month > today.month + 6) return today.year - 1;
  return today.year;
}

function berlinOffset(year, month, day, hour=12) {
  const probe = new Date(Date.UTC(year, month - 1, day, hour));
  const tz = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', timeZoneName: 'longOffset', hour: '2-digit'
  }).formatToParts(probe).find((x) => x.type === 'timeZoneName')?.value || 'GMT+01:00';
  const m = tz.match(/GMT([+-]\d{2}:\d{2})/);
  return m?.[1] || '+01:00';
}

function localIso(year, month, day, hour=0, minute=0) {
  const off = berlinOffset(year, month, day, hour);
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00${off}`;
}

function dateKey({year, month, day}) {
  return year * 10000 + month * 100 + day;
}

function currentKey() {
  return dateKey(today);
}

function imageNear(html, pos) {
  const start = Math.max(0, pos - 5000);
  const end = Math.min(html.length, pos + 7000);
  const chunk = html.slice(start, end);
  const urls = [...chunk.matchAll(/(?:src|data-src|content)=["'](https?:[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)]
    .map((m) => decode(m[1]))
    .filter((u) => /playstation|sie|tachyon|image\.api|ytimg/i.test(u));
  return urls[0] || null;
}

function storeUrlNear(html, pos) {
  const chunk = html.slice(pos, Math.min(html.length, pos + 12000));
  const m = chunk.match(/href=["'](https?:\/\/store\.playstation\.com\/[^"']+)["']/i);
  return m ? decode(m[1]) : null;
}

function discoverArticle(posts, kind) {
  const scored = posts.map((post) => {
    const t = post.title.toLowerCase();
    let score = 0;
    if (kind === 'plus') {
      if (/playstation plus/.test(t)) score += 40;
      if (/monatliche spiele/.test(t)) score += 60;
      if (t.includes(currentMonthName.toLowerCase())) score += 40;
      if (t.includes(String(today.year))) score += 20;
    } else if (kind === 'releases') {
      if (/ps5-spiele|ps5 spiele/.test(t)) score += 60;
      if (/release|erscheinen|neuerschein/.test(t)) score += 35;
      if (t.includes(currentMonthName.toLowerCase())) score += 45;
      if (t.includes(String(today.year))) score += 20;
    } else if (kind === 'store') {
      if (/playstation store/.test(t)) score += 35;
      if (/rabatt|sale|angebot|deal|spar/.test(t)) score += 55;
      if (/spielekatalog|monatliche spiele/.test(t)) score -= 60;
    }
    return { ...post, score };
  }).filter((x) => x.score > 0).sort((a,b) => b.score - a.score);
  return scored;
}

function parsePsPlus(html) {
  const text = strip(html);
  const articleTitle = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const titleMonth = articleTitle.match(new RegExp(`(${MONTHS.join('|')})\\s+(20\\d{2})`, 'i'));
  const labelMonth = titleMonth ? MONTHS[monthNumber(titleMonth[1]) - 1] : currentMonthName;
  const labelYear = titleMonth ? Number(titleMonth[2]) : today.year;

  const rangeRe = new RegExp(`(?:von|ab)[^0-9]{0,30}(\\d{1,2})\\.\\s*(${MONTHS.join('|')})[^0-9]{0,80}(?:bis|zum)[^0-9]{0,30}(\\d{1,2})\\.\\s*(${MONTHS.join('|')})`, 'i');
  const range = text.match(rangeRe);
  let window = null;
  if (range) {
    const sm = monthNumber(range[2]);
    const em = monthNumber(range[4]);
    const sy = yearForMonth(sm, labelYear);
    const ey = em < sm ? sy + 1 : sy;
    window = {
      start: { year: sy, month: sm, day: Number(range[1]) },
      end: { year: ey, month: em, day: Number(range[3]) }
    };
  }

  const games = [];
  for (const m of html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)) {
    const raw = strip(m[1]);
    const platformMatch = raw.match(/\|\s*((?:PS[45](?:\s*,\s*)?)+)\s*$/i);
    if (!platformMatch) continue;
    const title = raw.slice(0, raw.lastIndexOf('|')).trim();
    if (!title || /letzte chance|playstation plus/i.test(title)) continue;
    games.push({
      title,
      platform: platformMatch[1].replace(/\s*,\s*/g, ' · '),
      image: imageNear(html, m.index || 0),
      storeUrl: storeUrlNear(html, m.index || 0)
    });
  }

  return { label: `${labelMonth.toUpperCase()} ${labelYear}`, window, games: games.slice(0, 6) };
}

function parseReleaseSchedule(html) {
  const out = [];
  const monthRe = MONTHS.join('|');
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  for (let i = 0; i < headings.length; i++) {
    const m = headings[i];
    const title = strip(m[1]);
    if (!title || /schlusswort|highlights|playstation store|spotlight|playstation plus/i.test(title)) continue;
    const sectionEnd = headings[i + 1]?.index ?? Math.min(html.length, (m.index || 0) + 20000);
    const section = html.slice((m.index || 0) + m[0].length, sectionEnd);
    const text = strip(section);
    const dm = text.match(new RegExp(`Release:\\s*(\\d{1,2})\\.\\s*(${monthRe})\\s*(20\\d{2})?`, 'i'));
    if (!dm) continue;
    const month = monthNumber(dm[2]);
    const year = yearForMonth(month, dm[3]);
    const day = Number(dm[1]);
    const storeUrl = storeUrlNear(section, 0);
    out.push({
      date: `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}.`,
      title,
      year,
      storeUrl
    });
  }
  return out.filter((x,i,a) => a.findIndex((y) => y.title.toLowerCase() === x.title.toLowerCase()) === i)
    .sort((a,b) => (a.year*10000 + Number(a.date.slice(3,5))*100 + Number(a.date.slice(0,2))) - (b.year*10000 + Number(b.date.slice(3,5))*100 + Number(b.date.slice(0,2))));
}

function parseCampaign(html, title='') {
  const text = strip(html);
  const monthRe = MONTHS.join('|');
  const re = new RegExp(`(?:von|ab)[^0-9]{0,40}(\\d{1,2})\\.\\s*(${monthRe})[^0-9]{0,50}(?:(\\d{1,2}):(\\d{2})\\s*Uhr)?[\\s\\S]{0,160}?(?:bis|zum)[^0-9]{0,40}(\\d{1,2})\\.\\s*(${monthRe})[^0-9]{0,50}(?:(\\d{1,2}):(\\d{2})\\s*Uhr)?`, 'i');
  const m = text.match(re);
  if (!m) return null;
  const sm = monthNumber(m[2]);
  const em = monthNumber(m[6]);
  const sy = yearForMonth(sm);
  const ey = em < sm ? sy + 1 : sy;
  const startHour = Number(m[3] || 0), startMinute = Number(m[4] || 0);
  const endHour = Number(m[7] || 23), endMinute = Number(m[8] || 59);
  const storeLink = [...html.matchAll(/href=["'](https?:\/\/store\.playstation\.com\/[^"']+)["']/gi)]
    .map((x) => decode(x[1]))
    .find((u) => /\/category\/|\/view\//i.test(u)) || null;
  return {
    title: title || 'PlayStation Store-Angebote',
    start: localIso(sy, sm, Number(m[1]), startHour, startMinute),
    end: localIso(ey, em, Number(m[5]), endHour, endMinute),
    storeLink
  };
}

function normalizeStoreLocale(url) {
  if (!url) return url;
  return url.replace(/\/([a-z]{2})-([a-z]{2})\//i, '/de-de/');
}

function productLinks(html) {
  const abs = [...html.matchAll(/https?:\\?\/\\?\/store\.playstation\.com\\?\/[^"'\\s<]+?\\?\/product\\?\/[^"'\\s<]+/gi)]
    .map((m) => decode(m[0]).replace(/\\/g,''));
  const rel = [...html.matchAll(/["'](\/(?:de-de\/)?product\/[^"']+)["']/gi)]
    .map((m) => `https://store.playstation.com${m[1].startsWith('/de-de/') ? '' : '/de-de'}${m[1]}`);
  return [...new Set([...abs, ...rel].map(normalizeStoreLocale))].slice(0, 24);
}

function parseProduct(html, url) {
  const text = strip(html);
  const title = decode(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s*[|–-]\s*PlayStation.*$/i,'').trim();
  const image = decode(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '');
  const sale = text.match(/€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)\s*Preisnachlass gegenüber dem Originalpreis von\s*€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)/i);
  const discount = text.match(/Spare\s+(\d{1,2})\s*%/i);
  if (!title || !sale || !discount) return null;
  if (/add-on|währung|credits|points|coins|currency|season pass|upgrade/i.test(title)) return null;
  const price = Number(sale[1].replace(',','.'));
  const oldPrice = Number(sale[2].replace(',','.'));
  const pct = Number(discount[1]);
  if (!(price > 0 && oldPrice > price && pct > 0)) return null;
  const platform = /PS5/i.test(text) && /PS4/i.test(text) ? 'PS4 · PS5' : /PS5/i.test(text) ? 'PS5' : /PS4/i.test(text) ? 'PS4' : 'PlayStation';
  return {
    title,
    platform,
    discount: `-${pct} %`,
    price: `${sale[1].replace('.',',')} €`,
    oldPrice: `${sale[2].replace('.',',')} €`,
    image: image || null,
    url,
    pct,
    saving: oldPrice - price
  };
}

async function discoverDeals(collectionUrl) {
  if (!collectionUrl) return [];
  try {
    const collection = await get(normalizeStoreLocale(collectionUrl));
    const links = productLinks(collection.text);
    const deals = [];
    for (const url of links.slice(0, 16)) {
      try {
        const product = await get(url);
        const parsed = parseProduct(product.text, product.url || url);
        if (parsed) deals.push(parsed);
      } catch {}
      if (deals.length >= 8) break;
    }
    return deals.sort((a,b) => b.pct - a.pct || b.saving - a.saving).slice(0, 3);
  } catch {
    return [];
  }
}

function setResolved(key, value) {
  radar.resolvedSources = { ...(radar.resolvedSources || {}), [key]: value };
}

const notes = [];
let feedPosts = [];
try {
  const feed = await get(sources.playstationBlogFeed);
  feedPosts = rssItems(feed.text, 60);
} catch (e) {
  notes.push(`Feed discovery unavailable: ${e.message}`);
}

try {
  const candidates = discoverArticle(feedPosts, 'plus');
  const urls = [...new Set([...candidates.map((x) => x.link), sources.psPlusMonthly].filter(Boolean))].slice(0, 8);
  let selected = null;
  for (const url of urls) {
    try {
      const page = await get(url);
      const parsed = parsePsPlus(page.text);
      if (parsed.games.length < 3) continue;
      const active = parsed.window && currentKey() >= dateKey(parsed.window.start) && currentKey() <= dateKey(parsed.window.end);
      const sameMonth = parsed.label.startsWith(currentMonthName.toUpperCase());
      if (!selected || active || (sameMonth && !selected.active)) selected = { url: page.url, parsed, active, sameMonth };
      if (active) break;
    } catch {}
  }
  if (selected) {
    const { parsed } = selected;
    const oldImages = new Map((radar.plusGames || []).map((g) => [g.title.toLowerCase(), g.image]));
    radar.plusGames = parsed.games.slice(0,4).map((g) => ({
      title: g.title,
      image: g.image || oldImages.get(g.title.toLowerCase()) || null
    })).filter((g) => g.image);
    radar.psplusLabel = parsed.label;
    const monthPretty = parsed.label.split(' ')[0];
    radar.psplusTitle = `${monthPretty[0]}${monthPretty.slice(1).toLowerCase()}-Spiele sind live`;
    if (parsed.window) radar.psplusText = `Verfügbar bis ${String(parsed.window.end.day).padStart(2,'0')}.${String(parsed.window.end.month).padStart(2,'0')}.`;
    setResolved('psPlusMonthly', selected.url);
    setResolved('psPlusStoreUrls', Object.fromEntries(parsed.games.filter((g) => g.storeUrl).map((g) => [g.title, g.storeUrl])));
  }
} catch (e) {
  notes.push(`PS Plus V2: ${e.message}`);
}

try {
  const candidates = discoverArticle(feedPosts, 'releases');
  const urls = [...new Set([...candidates.map((x) => x.link), sources.monthlyReleases].filter(Boolean))].slice(0, 8);
  let selected = null;
  for (const url of urls) {
    try {
      const page = await get(url);
      const schedule = parseReleaseSchedule(page.text);
      if (schedule.length < 3) continue;
      const currentMonthHits = schedule.filter((x) => Number(x.date.slice(3,5)) === today.month && x.year === today.year).length;
      if (!selected || currentMonthHits > selected.currentMonthHits) selected = { url: page.url, schedule, currentMonthHits };
    } catch {}
  }
  if (selected) {
    const future = selected.schedule.filter((x) => {
      const key = x.year*10000 + Number(x.date.slice(3,5))*100 + Number(x.date.slice(0,2));
      return key >= currentKey();
    }).slice(0,5);
    if (future.length) radar.releases = future.map(({date,title}) => ({ date, title }));
    setResolved('monthlyReleases', selected.url);
    setResolved('releaseStoreUrls', Object.fromEntries(selected.schedule.filter((x) => x.storeUrl).map((x) => [x.title, x.storeUrl])));
  }
} catch (e) {
  notes.push(`Release V2: ${e.message}`);
}

try {
  const candidates = discoverArticle(feedPosts, 'store').slice(0, 10);
  let activeCampaign = null;
  for (const candidate of candidates) {
    try {
      const page = await get(candidate.link);
      const parsed = parseCampaign(page.text, candidate.title);
      if (!parsed) continue;
      const active = now.getTime() >= new Date(parsed.start).getTime() && now.getTime() <= new Date(parsed.end).getTime();
      if (active) {
        activeCampaign = { ...parsed, articleUrl: page.url };
        break;
      }
    } catch {}
  }

  if (activeCampaign) {
    radar.storeTitle = activeCampaign.title;
    radar.storeText = 'Automatisch entdeckte und gegen den deutschen PlayStation Store geprüfte Angebote.';
    radar.storeEnd = activeCampaign.end;
    setResolved('storeCampaign', activeCampaign.articleUrl);
    if (activeCampaign.storeLink) setResolved('storeCollection', normalizeStoreLocale(activeCampaign.storeLink));

    let discovered = await discoverDeals(activeCampaign.storeLink);
    if (discovered.length < 3) {
      const fallback = [];
      for (const source of sources.storeDeals || []) {
        try {
          const page = await get(source.url);
          const parsed = parseProduct(page.text, page.url || source.url);
          if (parsed) fallback.push(parsed);
        } catch {}
      }
      discovered = fallback.sort((a,b) => b.pct - a.pct || b.saving - a.saving).slice(0,3);
    }

    radar.deals = discovered.map(({title,platform,discount,price,oldPrice,image}) => ({ title, platform, discount, price, oldPrice, image }));
    setResolved('storeDeals', Object.fromEntries(discovered.map((x) => [x.title, x.url])));
    radar.leavingTitle = `${activeCampaign.title} laufen aus`;
    radar.leavingText = `Aktuelle Store-Aktion endet am ${new Intl.DateTimeFormat('de-DE', { timeZone:'Europe/Berlin', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(activeCampaign.end))} Uhr.`;
  } else {
    const oldEnd = radar.storeEnd ? new Date(radar.storeEnd).getTime() : 0;
    if (!oldEnd || oldEnd < now.getTime()) {
      radar.deals = [];
      radar.storeTitle = 'Keine verifizierten Top-Deals';
      radar.storeText = 'Derzeit wurde keine aktive offizielle Store-Aktion mit sicher verifizierbaren Top-Deals erkannt.';
      radar.storeEnd = null;
      radar.leavingTitle = 'Kein aktives Angebotsende';
      radar.leavingText = 'Der Radar wartet auf die nächste verifizierte PlayStation-Store-Aktion.';
      setResolved('storeDeals', {});
    }
  }
} catch (e) {
  notes.push(`Store V2: ${e.message}`);
}

try {
  let eaSource = sources.eaPlay;
  let eaPage = null;
  try { eaPage = await get(eaSource); }
  catch {
    if (sources.eaPlayGeneral) {
      eaSource = sources.eaPlayGeneral;
      eaPage = await get(eaSource);
    }
  }
  if (eaPage) {
    const text = strip(eaPage.text);
    const trial = text.match(/(?:10[- ]?stündige|10\s*Stunden|10h)[^.!?]{0,140}?(?:ab\s+dem\s+|ab\s+)?(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)/i);
    const items = [];
    if (/10\s*%/.test(text)) items.push('10 % auf digitale EA-Käufe');
    if (/Mitgliederbelohnungen|monatliche Boni/i.test(text)) items.push('Monatliche Mitgliederbelohnungen');
    if (/The Play List/i.test(text)) items.push('The Play List');
    radar.eaPlay = {
      title: radar.eaTitle || 'EA Play',
      trial: trial ? { hours: 10, date: `${String(Number(trial[1])).padStart(2,'0')}.${String(monthNumber(trial[2]) || today.month).padStart(2,'0')}.` } : null,
      items: items.length ? items : (radar.eaItems || []),
      sourceUrl: eaPage.url || eaSource
    };
    setResolved('eaPlay', eaPage.url || eaSource);
  }
} catch (e) {
  notes.push(`EA fallback V2: ${e.message}`);
}

radar.ubisoftPlus = {
  title: radar.ubisoftTitle || 'Ubisoft+ Classics',
  price: String(radar.ubisoftText || '').match(/([0-9]+,[0-9]{2}\s*€)\/Monat/i)?.[1] || null,
  items: radar.ubisoftItems || [],
  sourceUrl: sources.ubisoftPlus || null
};
setResolved('ubisoftPlus', sources.ubisoftPlus || null);

radar.automationV2 = {
  version: 2,
  checkedAt: new Date().toISOString(),
  month: currentMonthName,
  year: today.year,
  notes
};

await fs.writeFile(radarPath, JSON.stringify(radar, null, 2) + '\n');
console.log(`Automation V2 resolved current period; notes=${notes.length}.`);
