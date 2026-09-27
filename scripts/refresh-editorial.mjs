import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));

const now = new Date();
const berlin = new Intl.DateTimeFormat('de-DE', {timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(now);

function strip(v='') { return v.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,' ').replace(/&amp;|&#038;/g,'&').replace(/&quot;/g,'"').replace(/&#8217;/g,'’').replace(/&#8211;/g,'–').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim(); }
function items(xml) { return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>{const x=m[1];return {title:strip(x.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),link:strip(x.match(/<link>([\s\S]*?)<\/link>/i)?.[1]),pubDate:strip(x.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]),description:strip(x.match(/<description>([\s\S]*?)<\/description>/i)?.[1]),image:x.match(/(?:media:content|enclosure)[^>]+url=["']([^"']+)["']/i)?.[1]||null};}).filter(x=>x.title&&x.link&&x.pubDate); }
function fmt(d){return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
function score(x){const age=(now-new Date(x.pubDate))/864e5; const t=x.title.toLowerCase(); return 200-Math.min(age,60)*4 + (/ps5|playstation 5/.test(t)?20:0)+(/release|erscheint|jetzt erhältlich|ab heute|trailer|update|angekündigt/.test(t)?12:0)-(/gewinnspiel|community|cosplay/.test(t)?20:0);}
function meta(x){return (x.description||'Aktuelle PlayStation-Meldung').slice(0,150).replace(/\s+\S*$/,'').trim();}

const blogUrl = sources.playstationBlogFeed;
if (!blogUrl) throw new Error('Editorial freshness: PlayStation-Blog-Feed fehlt');
const res=await fetch(blogUrl,{headers:{'user-agent':'Mozilla/5.0 PlayStation-Radar/4.0','accept-language':'de-DE,de;q=0.9'}});
if(!res.ok) throw new Error(`Editorial freshness: Blog ${res.status}`);
const candidates=items(await res.text()).filter(x=>{const d=new Date(x.pubDate);return !Number.isNaN(d)&&((now-d)/864e5)<=21;}).sort((a,b)=>score(b)-score(a));
const chosen=[]; for(const x of candidates){if(!chosen.some(y=>y.title.toLowerCase()===x.title.toLowerCase())) chosen.push(x); if(chosen.length===3)break;}
if(chosen.length<3) throw new Error(`Editorial freshness: nur ${chosen.length}/3 aktuelle Meldungen`);

const slots=[['leadTitle','leadDate','leadMeta','leadImage'],['secondary1Title','secondary1Date','secondary1Meta','secondary1Image'],['secondary2Title','secondary2Date','secondary2Meta','secondary2Image']];
for(let i=0;i<3;i++){const [title,date,metaKey,image]=slots[i],x=chosen[i];radar[title]=x.title;radar[date]=fmt(new Date(x.pubDate));radar[metaKey]=meta(x);if(x.image)radar[image]=x.image;}
radar.editorialFreshness={status:'ok',checkedAt:new Date().toISOString(),date:berlin,maxAgeDays:21,selected:chosen.map(x=>({title:x.title,date:fmt(new Date(x.pubDate)),url:x.link}))};
radar.health ||= {}; radar.health.editorialFreshness='ok';
await fs.writeFile(radarPath,JSON.stringify(radar,null,2)+'\n');
console.log(`Editorial freshness: ${chosen.map(x=>x.title).join(' | ')}`);
