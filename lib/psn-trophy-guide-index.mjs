// Server-only, on-demand external trophy-guide index search.
// Source schema: https://github.com/langdonx/trophy-guide-list-json/tree/main/types
// No PSN IDs or account data are sent to the guide publisher.
const INDEX_URL='https://langdonx.github.io/trophy-guide-list-json/guides-v2.min.json';
const SOURCE={
  psnp:1<<0,knoef:1<<1,platget:1<<2,playstationtrophies:1<<3,
  powerpyx:1<<4,videogamelizard:1<<16,trophytom:1<<17
};
const FLAGS={guide:1<<5,dlc:1<<6,ps3:1<<7,ps4:1<<8,ps5:1<<9,vita:1<<10,
  buggy:1<<13,missable:1<<14,online:1<<15};
const SIX_HOURS=6*60*60*1000;
const cache={loadedAt:0,data:null,promise:null};
export const GUIDE_INDEX_SOURCE='langdonx/trophy-guide-list-json';
export const GUIDE_INDEX_URL='https://github.com/langdonx/trophy-guide-list-json';

function normalizeTitle(input){
 return typeof input==='string'
  ?input.normalize('NFKC').toLocaleLowerCase('en')
    .replace(/[®™©]/g,'').replace(/&/g,' and ')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ')
  :'';
}
function safePath(value){
 if(typeof value!=='string'||value.length<1||value.length>250)return null;
 // Reject absolute URLs, query strings, dot-segment traversal, control characters
 // and encoded characters. Publishers' guide identifiers are relative paths.
 if(value.startsWith('/'))return null;
 const clean=value.replace(/\/+$/g,'');
 if(!clean||!clean.split('/').every(part=>/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part)&&part!=='.'&&part!=='..'))
  return null;
 return clean;
}
export function externalTrophyGuideUrl(id,guide){
 const flags=guide?.a;
 if(!Number.isSafeInteger(flags))return null;
 const providers=[
  [SOURCE.knoef,'https://knoef.info/'],
  [SOURCE.platget,'https://www.platget.com/'],
  [SOURCE.playstationtrophies,'https://www.playstationtrophies.org/game/'],
  [SOURCE.powerpyx,'https://www.powerpyx.com/'],
  [SOURCE.videogamelizard,'https://videogamelizard.com/'],
  [SOURCE.trophytom,'https://www.trophy-tom.com/']
 ];
 const provider=providers.find(([flag])=>(flags&flag)!==0);
 if(provider){
  let path=guide.p||id;
  if(provider[0]===SOURCE.trophytom&&typeof path==='string')path=path.replace(/^trophy-tom\//,'');
  const valid=safePath(path);
  return valid?provider[1]+valid:null;
 }
 if((flags&SOURCE.psnp)!==0){
  const valid=safePath(id);
  return valid?'https://psnprofiles.com/guide/'+valid:null;
 }
 return null;
}
function guideSource(flags){
 return (flags&SOURCE.psnp)?'PSNProfiles':
  (flags&SOURCE.powerpyx)?'PowerPyx':
  (flags&SOURCE.playstationtrophies)?'PlayStationTrophies':
  (flags&SOURCE.knoef)?'Knoef':
  (flags&SOURCE.platget)?'PlatGet':
  (flags&SOURCE.trophytom)?'Trophy Tom':
  (flags&SOURCE.videogamelizard)?'VideoGameLizard':'Unbekannt';
}
function matchScore(name,title){
 const n=normalizeTitle(name),t=normalizeTitle(title);
 if(t.length<3||!n)return 0;
 if(n===t)return 4;
 if(!n.startsWith(t+' '))return 0;
 const suffix=n.slice(t.length+1);
 if(/^(?:(?:ps3|ps4|ps5|vita|vr) )?(?:platinum )?troph(?:y|ies) (?:guide|roadmap)(?: and roadmap)?$/.test(suffix))return 3;
 if(/^(?:walkthrough|platinum guide|achievement guide|guide and roadmap)$/.test(suffix))return 2;
 // An additional edition, sequel or DLC may share a prefix. Only display as a
 // manually selectable lower-confidence candidate; never assign automatically.
 return 1;
}
const rating=(value,max)=>typeof value==='number'&&Number.isFinite(value)
 &&value>=0&&value<=max?value:null;
const displayName=value=>String(value||'').trim().slice(0,180);
export function findTrophyGuideCandidates(source,title,{limit=8}={}){
 if(!source||typeof source!=='object'||Array.isArray(source))return [];
 if(typeof title!=='string'||title.trim().length<3||title.length>125)return [];
 const cap=Math.min(12,Math.max(1,Math.trunc(limit)||8));
 const matches=[];
 for(const [id,item] of Object.entries(source)){
  if(!item||typeof item!=='object'||Array.isArray(item))continue;
  const name=displayName(item.n),a=item.a;
  if(!Number.isSafeInteger(a)||!name)continue;
  const score=matchScore(name,title);
  if(!score)continue;
  const url=externalTrophyGuideUrl(id,item);
  if(!url)continue;
  const r=Array.isArray(item.r)?item.r:[];
  const platform=[
   a&FLAGS.ps5?'PS5':null,a&FLAGS.ps4?'PS4':null,
   a&FLAGS.ps3?'PS3':null,a&FLAGS.vita?'Vita':null
  ].filter(Boolean);
  matches.push({
   title:name,url,source:guideSource(a),
   difficulty:rating(r[0],10),playthroughs:rating(r[1],100),
   hours:rating(r[2],2000),platforms:platform,
   hasMissable:Boolean(a&FLAGS.missable),
   hasOnline:Boolean(a&FLAGS.online),
   hasBuggy:Boolean(a&FLAGS.buggy),
   isDlc:Boolean(a&FLAGS.dlc),
   isTrophyGuide:Boolean(a&FLAGS.guide),
   match:score===4?'exact':score>=2?'title-guide':'related-title',
   _score:score*10+(a&FLAGS.guide?2:0)-(a&FLAGS.dlc?1:0)
  });
 }
 matches.sort((a,b)=>b._score-a._score
  ||Number(a.difficulty===null)-Number(b.difficulty===null)
  ||a.title.localeCompare(b.title,'de')
  ||a.url.localeCompare(b.url));
 const seen=new Set();
 return matches.filter(row=>{if(seen.has(row.url))return false;seen.add(row.url);return true})
  .slice(0,cap).map(({_score,...row})=>row);
}
export async function loadTrophyGuideIndex({
 fetcher=fetch,now=()=>Date.now()
}={}){
 const time=now();
 if(cache.data&&time-cache.loadedAt<SIX_HOURS)return cache.data;
 if(cache.promise)return cache.promise;
 const promise=(async()=>{
  const response=await fetcher(INDEX_URL,{headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(11000),cache:'no-store'});
  if(!response?.ok)throw Error('Guide index upstream unavailable');
  const declared=Number(response.headers?.get?.('content-length'));
  if(declared>5_000_000)throw Error('Guide index exceeds size limit');
  const body=await response.text();
  if(body.length>5_000_000)throw Error('Guide index exceeds size limit');
  const parsed=JSON.parse(body);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)
   ||Object.keys(parsed).length<100)throw Error('Guide index response invalid');
  cache.data=parsed;cache.loadedAt=now();
  return parsed;
 })().finally(()=>{cache.promise=null});
 cache.promise=promise;
 return promise;
}
export async function lookupTrophyGuides(title,{loader=loadTrophyGuideIndex}={}){
 const name=String(title||'').trim();
 if(name.length<3||name.length>125)throw Error('Invalid game title');
 const source=await loader();
 return {source:GUIDE_INDEX_SOURCE,sourceUrl:GUIDE_INDEX_URL,
  sourceType:'third-party-index',matches:findTrophyGuideCandidates(source,name)};
}
