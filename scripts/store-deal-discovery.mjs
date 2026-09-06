import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const collectionUrl = radar.resolvedSources?.storeCollection || null;
const campaignEnd = radar.storeEnd ? new Date(radar.storeEnd) : null;
const now = new Date();

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 PlayStation-Radar/2.1',
      'accept-language': 'de-DE,de;q=0.9,en;q=0.7',
      accept: 'text/html,application/xhtml+xml,*/*;q=0.8'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { text: await res.text(), url: res.url };
}

function decode(s='') {
  return s.replace(/&amp;|&#038;/g,'&')
    .replace(/&quot;|&#34;/g,'"')
    .replace(/&#39;|&#8217;/g,'’')
    .replace(/&nbsp;/g,' ')
    .replace(/\\u0026/g,'&')
    .replace(/\\u002F/gi,'/')
    .replace(/\\\//g,'/');
}

function strip(s='') {
  return decode(s)
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function normalizeStoreUrl(raw='') {
  let url = decode(raw).replace(/\\/g,'').trim();
  if (!url) return null;
  if (url.startsWith('/')) url = `https://store.playstation.com${url}`;
  if (!/^https:\/\/store\.playstation\.com\//i.test(url)) return null;
  url = url.replace(/\/([a-z]{2})-([a-z]{2})\//i, '/de-de/');
  return url.split('?')[0].replace(/\/$/, '');
}

function productLinks(html) {
  const found = [];
  const patterns = [
    /https?:\\?\/\\?\/store\.playstation\.com\\?\/[^"'\s<>]+?\\?\/product\\?\/[^"'\s<>]+/gi,
    /https?:\/\/store\.playstation\.com\/[^"'\s<>]+?\/product\/[^"'\s<>]+/gi,
    /["'](\/(?:[a-z]{2}-[a-z]{2}\/)?product\/[^"']+)["']/gi,
    /["'](\/(?:[a-z]{2}-[a-z]{2}\/)?concept\/[^"']+)["']/gi
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const candidate = normalizeStoreUrl(match[1] || match[0]);
      if (candidate) found.push(candidate);
    }
  }
  return [...new Set(found)].slice(0, 60);
}

function numericPrice(raw='') {
  const value = Number(String(raw).replace(/\./g,'').replace(',','.').replace(/[^0-9.]/g,''));
  return Number.isFinite(value) ? value : null;
}

function money(raw='') {
  return `${String(raw).replace('.',',')} €`;
}

function parseProduct(html, sourceUrl) {
  const text = strip(html);
  const titleRaw = decode(
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      || ''
  );
  const title = titleRaw
    .replace(/\s*[|–-]\s*PlayStation(?:™)?\s*Store.*$/i,'')
    .replace(/\s*[|–-]\s*PS[45].*$/i,'')
    .trim();
  if (!title || title.length < 2 || title.length > 120) return null;
  if (/add-on|dlc|season pass|upgrade|coins|credits|points|währung|currency|token|virtual currency/i.test(title)) return null;

  const image = decode(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || '');
  const sale = text.match(/€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)\s*Preisnachlass gegenüber dem Originalpreis von\s*€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)/i)
    || text.match(/([0-9]{1,3}(?:[.,][0-9]{2})?)\s*€\s*Preisnachlass gegenüber dem Originalpreis von\s*([0-9]{1,3}(?:[.,][0-9]{2})?)\s*€/i);
  const discountMatch = text.match(/Spare\s+(\d{1,2})\s*%/i)
    || text.match(/(\d{1,2})\s*%\s*(?:Rabatt|Preisnachlass)/i);
  if (!sale) return null;

  const current = numericPrice(sale[1]);
  const original = numericPrice(sale[2]);
  if (!(current > 0 && original > current)) return null;
  const calculated = Math.round((1 - current / original) * 100);
  const discount = discountMatch ? Number(discountMatch[1]) : calculated;
  if (!Number.isFinite(discount) || discount < 10 || discount > 95 || Math.abs(discount - calculated) > 3) return null;

  const hasPS5 = /\bPS5\b|PlayStation 5/i.test(text);
  const hasPS4 = /\bPS4\b|PlayStation 4/i.test(text);
  const platform = hasPS5 && hasPS4 ? 'PS4 · PS5' : hasPS5 ? 'PS5' : hasPS4 ? 'PS4' : 'PlayStation';

  return {
    title,
    platform,
    price: money(sale[1]),
    oldPrice: money(sale[2]),
    discount: `-${discount} %`,
    image: image || null,
    sourceUrl,
    _score: discount * 100 + (hasPS5 ? 35 : 0) + Math.min(30, Math.round(original))
  };
}

async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try { out[index] = await worker(items[index]); }
      catch (error) { out[index] = { error: error.message, url: items[index] }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

const telemetry = {
  checkedAt: new Date().toISOString(),
  collection: collectionUrl,
  activeCampaign: Boolean(campaignEnd && !Number.isNaN(campaignEnd.getTime()) && campaignEnd.getTime() > now.getTime()),
  links: 0,
  fetched: 0,
  verified: 0,
  selected: 0,
  mode: 'not-run',
  warnings: []
};

if (!telemetry.activeCampaign || !collectionUrl) {
  telemetry.mode = !telemetry.activeCampaign ? 'no-active-campaign' : 'no-collection';
  radar.storeDiscovery = telemetry;
  await fs.writeFile(radarPath, JSON.stringify(radar,null,2)+'\n');
  console.log(`Store discovery skipped: ${telemetry.mode}.`);
  process.exit(0);
}

try {
  const collection = await get(collectionUrl);
  const links = productLinks(collection.text);
  telemetry.links = links.length;
  if (!links.length) {
    telemetry.mode = 'collection-not-machine-readable';
    telemetry.warnings.push('Store-Kategorieseite enthält keine direkt extrahierbaren Produktlinks.');
  } else {
    const results = await pool(links.slice(0, 36), 6, async (url) => {
      const page = await get(url);
      return parseProduct(page.text, page.url);
    });
    telemetry.fetched = results.length;
    const verified = results.filter((item) => item && !item.error && item.title && item.discount);
    telemetry.verified = verified.length;

    const unique = verified.filter((item, index, all) =>
      all.findIndex((x) => x.title.toLowerCase() === item.title.toLowerCase()) === index
    ).sort((a,b) => b._score - a._score);

    const selected = unique.slice(0, 3).map(({ _score, sourceUrl, ...deal }) => deal);
    if (selected.length >= 3) {
      radar.deals = selected;
      radar.storeTitle = 'Aktuelle Store-Top-Deals';
      radar.storeText = 'Automatisch aus der aktuell verifizierten PlayStation-Store-Aktion ausgewählt.';
      radar.resolvedSources = {
        ...(radar.resolvedSources || {}),
        storeDeals: Object.fromEntries(unique.slice(0,3).map((item) => [item.title, item.sourceUrl]))
      };
      telemetry.selected = selected.length;
      telemetry.mode = 'dynamic';
    } else {
      telemetry.mode = 'insufficient-verified-products';
      telemetry.warnings.push(`Nur ${selected.length} verifizierbare Deal-Produkte entdeckt; bestehende verifizierte Auswahl bleibt erhalten.`);
    }
  }
} catch (error) {
  telemetry.mode = 'error';
  telemetry.warnings.push(error.message);
}

radar.storeDiscovery = telemetry;
radar.automationV2 = {
  ...(radar.automationV2 || {}),
  resolved: {
    ...(radar.automationV2?.resolved || {}),
    storeDiscoveryMode: telemetry.mode,
    storeDiscoveryLinks: telemetry.links,
    storeDiscoveryVerified: telemetry.verified,
    storeDiscoverySelected: telemetry.selected
  }
};

await fs.writeFile(radarPath, JSON.stringify(radar,null,2)+'\n');
console.log(`Store discovery: mode=${telemetry.mode}; links=${telemetry.links}; verified=${telemetry.verified}; selected=${telemetry.selected}.`);
