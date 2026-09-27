import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));

const now = new Date();
const berlin = new Intl.DateTimeFormat('de-DE', {timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(now);

function decodeEntities(value='') {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g,'')
    .replace(/&amp;|&#038;/gi,'&')
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&apos;|&#39;/gi,'’')
    .replace(/&#8216;|&#8217;/g,'’')
    .replace(/&#8220;|&#8221;/g,'"')
    .replace(/&#8211;/g,'–')
    .replace(/&#8212;/g,'—')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&euro;|&#8364;/gi,'€')
    .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16)))
    .replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)));
}
function strip(v='') { return decodeEntities(v).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
function items(xml) { return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>{const x=m[1];const image=x.match(/(?:media:content|enclosure)[^>]+url=["']([^"']+)["']/i)?.[1]||x.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]||null;return {title:strip(x.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),link:strip(x.match(/<link>([\s\S]*?)<\/link>/i)?.[1]),pubDate:strip(x.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]),description:strip(x.match(/<description>([\s\S]*?)<\/description>/i)?.[1]),image:image?decodeEntities(image):null};}).filter(x=>x.title&&x.link&&x.pubDate); }
function fmt(d){return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
function score(x){const age=(now-new Date(x.pubDate))/864e5; const t=x.title.toLowerCase(); return 200-Math.min(age,60)*4 + (/ps5|playstation 5/.test(t)?20:0)+(/release|erscheint|jetzt erhältlich|ab heute|trailer|update|angekündigt/.test(t)?12:0)-(/gewinnspiel|community|cosplay/.test(t)?20:0);}
function meta(x){
  const text = String(x.description || 'Aktuelle PlayStation-Meldung').replace(/\s+/g,' ').trim();
  const max = 150;
  if (text.length <= max) return text;
  const window = text.slice(0, max + 1);
  const sentenceEnds = [...window.matchAll(/[.!?](?=\s|$)/g)].map(match => match.index + 1).filter(index => index >= 80);
  if (sentenceEnds.length) return window.slice(0, sentenceEnds.at(-1)).trim();
  const cut = window.slice(0, max).replace(/\s+\S*$/,'').replace(/[,:;\-–—]+$/,'').trim();
  return `${cut}…`;
}
function pageHero(html='') {
  const candidates = [
    html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i)?.[1],
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1]
  ].filter(Boolean);
  return candidates.length ? decodeEntities(candidates[0]) : null;
}
async function enrichArticle(item) {
  try {
    const res = await fetch(item.link,{headers:{'user-agent':'Mozilla/5.0 PlayStation-Radar/4.1','accept-language':'de-DE,de;q=0.9'},redirect:'follow'});
    if (!res.ok) return item;
    const html = await res.text();
    return {...item, link:res.url||item.link, image:pageHero(html)||item.image};
  } catch { return item; }
}

const blogUrl = sources.playstationBlogFeed;
if (!blogUrl) throw new Error('Editorial freshness: PlayStation-Blog-Feed fehlt');
const res=await fetch(blogUrl,{headers:{'user-agent':'Mozilla/5.0 PlayStation-Radar/4.1','accept-language':'de-DE,de;q=0.9'}});
if(!res.ok) throw new Error(`Editorial freshness: Blog ${res.status}`);
const candidates=items(await res.text()).filter(x=>{const d=new Date(x.pubDate);return !Number.isNaN(d)&&((now-d)/864e5)<=21;}).sort((a,b)=>score(b)-score(a));
const selected=[]; for(const x of candidates){if(!selected.some(y=>y.title.toLowerCase()===x.title.toLowerCase())) selected.push(x); if(selected.length===3)break;}
if(selected.length<3) throw new Error(`Editorial freshness: nur ${selected.length}/3 aktuelle Meldungen`);
const chosen=[]; for (const item of selected) chosen.push(await enrichArticle(item));

const slots=[['leadTitle','leadDate','leadMeta','leadImage','leadPrice'],['secondary1Title','secondary1Date','secondary1Meta','secondary1Image','secondary1Price'],['secondary2Title','secondary2Date','secondary2Meta','secondary2Image','secondary2Price']];
for(let i=0;i<3;i++){const [title,date,metaKey,image,price]=slots[i],x=chosen[i];radar[title]=x.title;radar[date]=fmt(new Date(x.pubDate));radar[metaKey]=meta(x);radar[price]=null;if(x.image)radar[image]=x.image;}
const editorialTitles = new Set(chosen.map(x=>x.title.toLowerCase()));
radar.sourceAlerts = [
  ...(radar.sourceAlerts||[]).filter(item=>!editorialTitles.has(String(item.title||'').toLowerCase())),
  ...chosen.map(item=>({title:item.title,url:item.link,type:'editorial'}))
];
radar.editorialFreshness={status:'ok',checkedAt:new Date().toISOString(),date:berlin,maxAgeDays:21,selected:chosen.map(x=>({title:x.title,date:fmt(new Date(x.pubDate)),url:x.link,image:x.image||null}))};
radar.health ||= {}; radar.health.editorialFreshness='ok';
await fs.writeFile(radarPath,JSON.stringify(radar,null,2)+'\n');
console.log(`Editorial freshness: ${chosen.map(x=>x.title).join(' | ')}`);
