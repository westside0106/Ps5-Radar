import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const archiveDir = new URL('../data/archive/', import.meta.url);
const archiveIndexPath = new URL('../data/archive/index.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTH_INDEX = Object.fromEntries(MONTHS.map((name, i) => [name.toLowerCase(), i + 1]));
const now = new Date();
const berlinDate = new Intl.DateTimeFormat('de-DE', { timeZone:'Europe/Berlin', day:'2-digit', month:'2-digit', year:'numeric' }).format(now);
const [todayDay,todayMonth,todayYear] = berlinDate.split('.').map(Number);

async function get(url) {
  const res = await fetch(url,{headers:{'user-agent':'Mozilla/5.0 PlayStation-Radar/2.0','accept-language':'de-DE,de;q=0.9,en;q=0.7'},redirect:'follow'});
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}
function decode(s='') { return s.replace(/&amp;|&#038;/g,'&').replace(/&quot;/g,'"').replace(/&#8217;|&#39;/g,'’').replace(/&#8211;/g,'–').replace(/&nbsp;/g,' ').replace(/&euro;|&#8364;/g,'€'); }
function strip(s='') { return decode(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
function monthNumber(name) { return MONTH_INDEX[String(name || '').toLowerCase()] || null; }
function parseReleaseSchedule(html) {
  const out=[]; const headings=[...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]; const monthRe=MONTHS.join('|');
  for (let i=0;i<headings.length;i++) {
    const heading=headings[i]; const title=strip(heading[1]);
    if (!title || /schlusswort|highlights|playstation store|spotlight|playstation plus/i.test(title)) continue;
    const end=headings[i+1]?.index ?? Math.min(html.length,(heading.index||0)+20000);
    const section=strip(html.slice((heading.index||0)+heading[0].length,end));
    const dm=section.match(new RegExp(`Release:\\s*(\\d{1,2})\\.\\s*(${monthRe})\\s*(20\\d{2})?`,'i'));
    if (!dm) continue;
    const month=monthNumber(dm[2]); let year=dm[3]?Number(dm[3]):todayYear; if (!dm[3] && month<todayMonth-6) year+=1;
    out.push({date:`${String(Number(dm[1])).padStart(2,'0')}.${String(month).padStart(2,'0')}.`,title,year});
  }
  return out.filter((x,i,a)=>a.findIndex((y)=>y.title.toLowerCase()===x.title.toLowerCase())===i).sort((a,b)=>(a.year*10000+Number(a.date.slice(3,5))*100+Number(a.date.slice(0,2)))-(b.year*10000+Number(b.date.slice(3,5))*100+Number(b.date.slice(0,2))));
}
function money(raw) { return raw.replace('.',',')+' €'; }
function parsePrimarySale(html,title='') {
  const text=strip(html); const at=title?text.toLowerCase().indexOf(title.toLowerCase()):0; const chunk=at>=0?text.slice(at,at+5000):text;
  const m=chunk.match(/€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)\s*Preisnachlass gegenüber dem Originalpreis von\s*€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)/i)||text.match(/€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)\s*Preisnachlass gegenüber dem Originalpreis von\s*€\s*([0-9]{1,3}(?:[.,][0-9]{2})?)/i);
  const d=chunk.match(/Spare\s+(\d{1,2})\s*%/i)||text.match(/Spare\s+(\d{1,2})\s*%/i);
  if (!m||!d) throw new Error(`Kein aktives eindeutig parsebares Angebot${title?`: ${title}`:''}`);
  const current=Number(m[1].replace('.','').replace(',','.')); const original=Number(m[2].replace('.','').replace(',','.')); const pct=Number(d[1]); const expected=Math.round((1-current/original)*100);
  if (!(current>0&&original>current)||Math.abs(expected-pct)>2) throw new Error(`Preisvalidierung fehlgeschlagen${title?`: ${title}`:''} ${current}/${original}/${pct}%`);
  return {price:money(m[1]),oldPrice:money(m[2]),discount:`-${pct} %`};
}
function normalizeMeta(dateKey,metaKey) { if (!radar[dateKey]||radar[dateKey]===berlinDate||!radar[metaKey]) return; radar[metaKey]=radar[metaKey].replace(/^Heute neu auf PS5\s*·\s*/i,'PS5 · ').replace(/^Seit\s+\d{2}\.\d{2}\.\s+auf PS5\s*·\s*/i,'PS5 · '); }
async function writeValidatedArchive() {
  await fs.mkdir(archiveDir,{recursive:true}); let index=[]; try { index=JSON.parse(await fs.readFile(archiveIndexPath,'utf8')); } catch {}
  const match=String(radar.edition||'').match(/#(\d+)/); if (!match) throw new Error('Ausgabennummer fehlt'); const id=String(Number(match[1])).padStart(3,'0'); const file=`${id}.json`;
  await fs.writeFile(new URL(file,archiveDir),JSON.stringify(radar,null,2)+'\n');
  const item={id,edition:radar.edition,date:radar.date,headline:radar.newHeadline,lead:radar.leadTitle,image:radar.leadImage,file}; const existing=index.findIndex((x)=>x.id===id); if (existing>=0) index[existing]=item; else index.unshift(item); index.sort((a,b)=>Number(b.id)-Number(a.id));
  await fs.writeFile(archiveIndexPath,JSON.stringify(index,null,2)+'\n');
}

const fatal=[]; const warnings=[];
try {
  const releaseUrl=radar.resolvedSources?.monthlyReleases||sources.monthlyReleases; if (!releaseUrl) throw new Error('keine Monatsquelle aufgelöst');
  const html=await get(releaseUrl); const schedule=parseReleaseSchedule(html); if (schedule.length<3) throw new Error(`nur ${schedule.length} Release-Einträge erkannt`);
  const todayKey=todayYear*10000+todayMonth*100+todayDay;
  const future=schedule.filter((x)=>(x.year*10000+Number(x.date.slice(3,5))*100+Number(x.date.slice(0,2)))>=todayKey).slice(0,5);
  // Ein vollstaendig abgelaufener Monatsplan ist kein Quellenfehler. Wichtig
  // ist, dass die Quelle erfolgreich gelesen und als plausibler Plan erkannt
  // wurde. Alte Termine duerfen dann nicht als scheinbar aktuelle Releases
  // stehen bleiben.
  radar.releases=future.map(({date,title})=>({date,title}));
} catch(e) { fatal.push(`Releases: ${e.message}`); }

const storeEnd=radar.storeEnd?new Date(radar.storeEnd):null; const storeActive=Boolean(storeEnd&&!Number.isNaN(storeEnd.getTime())&&storeEnd.getTime()>now.getTime());
if (!storeActive) {
  if ((radar.deals||[]).length) warnings.push('Store: abgelaufene oder fehlende Kampagne erkannt; Deals wurden entfernt');
  radar.deals=[];
  if (!radar.storeEnd||(storeEnd&&storeEnd.getTime()<=now.getTime())) { radar.storeTitle='Keine verifizierten Top-Deals'; radar.storeText='Derzeit wurde keine aktive offizielle Store-Aktion mit sicher verifizierbaren Top-Deals erkannt.'; radar.storeEnd=null; }
} else {
  const urls=radar.resolvedSources?.storeDeals||{}; const valid=[];
  for (const deal of radar.deals||[]) {
    const url=urls[deal.title]||(sources.storeDeals||[]).find((x)=>x.title===deal.title)?.url;
    if (!url) { warnings.push(`Store ${deal.title}: keine Produktquelle aufgelöst`); continue; }
    try { const html=await get(url); const parsed=parsePrimarySale(html,deal.title); valid.push({...deal,...parsed}); } catch(e) { warnings.push(`Store ${deal.title}: ${e.message}`); }
  }
  radar.deals=valid;
  if (!valid.length) { radar.storeTitle='Keine verifizierten Top-Deals'; radar.storeText='Die aktive Store-Aktion wurde erkannt, aber aktuell konnte kein Deal sicher gegen eine Produktseite validiert werden.'; }
}

try {
  if (!radar.psplusLabel||!(radar.plusGames||[]).length) throw new Error('PS-Plus-Daten fehlen');
  const labelMatch=radar.psplusLabel.match(new RegExp(`(${MONTHS.join('|')})\\s+(20\\d{2})`,'i')); if (!labelMatch) throw new Error(`ungültiges Label ${radar.psplusLabel}`);
  const labelMonth=monthNumber(labelMatch[1]); const labelYear=Number(labelMatch[2]); const monthDistance=(todayYear-labelYear)*12+(todayMonth-labelMonth); if (monthDistance>1) throw new Error(`veralteter Monat ${radar.psplusLabel}`);
} catch(e) { fatal.push(`PS Plus: ${e.message}`); }
normalizeMeta('leadDate','leadMeta'); normalizeMeta('secondary1Date','secondary1Meta'); normalizeMeta('secondary2Date','secondary2Meta');
radar.health={...(radar.health||{}),status:fatal.length?'warning':warnings.length?'warning':'ok',warnings:fatal.length+warnings.length,checkedAt:new Date().toISOString()};
radar.sourceCheck={...(radar.sourceCheck||{}),errors:[...fatal,...warnings]};
await fs.writeFile(radarPath,JSON.stringify(radar,null,2)+'\n');
if (fatal.length) { console.error(fatal.join('\n')); process.exit(1); }
await writeValidatedArchive();
console.log(`Radar V2 validation passed; storeDeals=${radar.deals.length}; warnings=${warnings.length}.`);
