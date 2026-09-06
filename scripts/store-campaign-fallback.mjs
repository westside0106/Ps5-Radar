import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));

if (radar.resolvedSources?.storeCampaign || !sources.storeCampaign) {
  console.log('Store campaign fallback not needed.');
  process.exit(0);
}

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTH_INDEX = Object.fromEntries(MONTHS.map((name, i) => [name.toLowerCase(), i + 1]));
const now = new Date();
const parts = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit'
}).formatToParts(now);
const getPart = (type) => Number(parts.find((p) => p.type === type)?.value);
const current = { year:getPart('year'), month:getPart('month'), day:getPart('day') };

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent':'Mozilla/5.0 PlayStation-Radar/2.0',
      'accept-language':'de-DE,de;q=0.9,en;q=0.7'
    },
    redirect:'follow'
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { text: await res.text(), url: res.url };
}

function decode(s='') {
  return s.replace(/&amp;|&#038;/g,'&').replace(/&nbsp;/g,' ').replace(/&#8211;/g,'–').replace(/&#8217;/g,'’');
}

function strip(s='') {
  return decode(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

function monthNumber(name) {
  return MONTH_INDEX[String(name || '').toLowerCase()] || null;
}

function yearForMonth(month) {
  if (month < current.month - 6) return current.year + 1;
  if (month > current.month + 6) return current.year - 1;
  return current.year;
}

function berlinOffset(year, month, day, hour=12) {
  const probe = new Date(Date.UTC(year, month - 1, day, hour));
  const tz = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Europe/Berlin', timeZoneName:'longOffset', hour:'2-digit'
  }).formatToParts(probe).find((x) => x.type === 'timeZoneName')?.value || 'GMT+01:00';
  const match = tz.match(/GMT([+-]\d{2}:\d{2})/);
  return match?.[1] || '+01:00';
}

function localIso(year, month, day, hour, minute) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00${berlinOffset(year,month,day,hour)}`;
}

const page = await get(sources.storeCampaign);
const text = strip(page.text);
const monthRe = MONTHS.join('|');
const re = new RegExp(`\\bvon\\b[^0-9]{0,40}(\\d{1,2})\\.\\s*(${monthRe})[^0-9]{0,50}(?:(\\d{1,2}):(\\d{2})\\s*Uhr)?[\\s\\S]{0,180}?\\bbis\\b[^0-9]{0,40}(\\d{1,2})\\.\\s*(${monthRe})[^0-9]{0,50}(?:(\\d{1,2}):(\\d{2})\\s*Uhr)?`, 'i');
const match = text.match(re);
if (!match) throw new Error('Configured Store campaign window could not be parsed.');

const startMonth = monthNumber(match[2]);
const endMonth = monthNumber(match[6]);
const startYear = yearForMonth(startMonth);
const endYear = endMonth < startMonth ? startYear + 1 : startYear;
const start = localIso(startYear, startMonth, Number(match[1]), Number(match[3] || 0), Number(match[4] || 0));
const end = localIso(endYear, endMonth, Number(match[5]), Number(match[7] || 23), Number(match[8] || 59));
const active = now.getTime() >= new Date(start).getTime() && now.getTime() <= new Date(end).getTime();

if (!active) {
  console.log('Configured Store campaign is not active.');
  process.exit(0);
}

const storeLink = [...page.text.matchAll(/href=["'](https?:\/\/store\.playstation\.com\/[^"']+)["']/gi)]
  .map((m) => decode(m[1]))
  .find((url) => /\/category\/|\/view\//i.test(url)) || null;

radar.storeEnd = end;
radar.resolvedSources = {
  ...(radar.resolvedSources || {}),
  storeCampaign: page.url,
  ...(storeLink ? { storeCollection: storeLink.replace(/\/([a-z]{2})-([a-z]{2})\//i,'/de-de/') } : {}),
  storeDeals: Object.fromEntries((sources.storeDeals || []).map((item) => [item.title, item.url]))
};
radar.automationV2 = {
  ...(radar.automationV2 || {}),
  resolved: {
    ...(radar.automationV2?.resolved || {}),
    storeCampaign: page.url,
    storeCollection: radar.resolvedSources.storeCollection || null,
    storeDeals: Object.keys(radar.resolvedSources.storeDeals || {}).length
  }
};

await fs.writeFile(radarPath, JSON.stringify(radar,null,2)+'\n');
console.log('Configured active Store campaign resolved as fallback.');
