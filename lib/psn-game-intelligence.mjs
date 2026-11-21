// Source-aware, on-demand game intelligence. All requests run server-side.
// HLTB search protocol follows Deadlock-too/howlongtobeat-ts (MIT), no runtime
// package dependency; its undocumented endpoint may reject datacentre clients.
// FPS and Store snapshots are third-party source records, not live measurements.
export const GAME_INTEL_SOURCES=Object.freeze({
 fps:'arthurcarlsonn/framepatch',
 store:'Ephellon/game-store-catalog',
 hltb:'Deadlock-too/howlongtobeat-ts'
});
const URL_FPS='https://raw.githubusercontent.com/arthurcarlsonn/framepatch/main/data/fpsRecords.json';
const STORE_BASE='https://raw.githubusercontent.com/Ephellon/game-store-catalog/main/psn/';
const HLTB='https://howlongtobeat.com/';
const HLTB_UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const fresh=new Map();
const MAX=4_000_000;
export const cleanGameTitle=value=>String(value||'').normalize('NFKC').replace(/[®™©]/g,'')
 .replace(/\s*\((?:PS[345]|PlayStation\s*[345])\)\s*$/i,'')
 .replace(/\s+(?:PS[345])\s*$/i,'')
 .replace(/\s+/g,' ').trim();
export const gameSlug=value=>cleanGameTitle(value).toLowerCase()
 .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function titleKey(value){return cleanGameTitle(value).normalize('NFKD').toLowerCase()
 .replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();}
const number=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max?value:null;
const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)?value:null;
function trustedSourceUrl(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||
  !['digitalfoundry.net','www.digitalfoundry.net','eurogamer.net','www.eurogamer.net',
   'ign.com','www.ign.com','gamingbolt.com','www.gamingbolt.com',
   'pushsquare.com','www.pushsquare.com','youtube.com','www.youtube.com',
   'rpgsite.net','www.rpgsite.net','stevivor.com','www.stevivor.com',
   'videogameschronicle.com','www.videogameschronicle.com','prosperopatches.com',
   'orbispatches.com','mp1st.com','www.mp1st.com','support.sms.playstation.com',
   'blog.playstation.com'].includes(u.hostname))return null;
  return u.href.slice(0,600);
 }catch{return null;}
}
async function loadJson(url,{fetcher=fetch,maxBytes=MAX,ttl=12*3600000,now=()=>Date.now()}={}){
 const cached=fresh.get(url),time=now();
 if(cached&&cached.expires>time)return cached.value;
 const res=await fetcher(url,{signal:AbortSignal.timeout(9000),cache:'no-store',headers:{Accept:'application/json'}});
 if(!res?.ok)throw Error('Provider not available');
 const count=Number(res.headers?.get?.('content-length'));
 if(count>maxBytes)throw Error('Provider response too large');
 const text=await res.text();
 if(text.length>maxBytes)throw Error('Provider response too large');
 const parsed=JSON.parse(text);
 if(!parsed||typeof parsed!=='object')throw Error('Provider response invalid');
 fresh.set(url,{value:parsed,expires:time+ttl*1000});
 return parsed;
}
export function fpsEvidenceFor(title,snapshot){
 const slug=gameSlug(title);
 if(!slug||!snapshot||typeof snapshot!=='object'||!snapshot.entries)return null;
 const candidates=Object.values(snapshot.entries).filter(x=>x?.data?.slug===slug);
 // The same title might refer to two different IGDB editions. Never guess.
 if(candidates.length!==1)return null;
 const record=candidates[0].data;
 const entries=(Array.isArray(record.entries)?record.entries:[])
  .filter(x=>x?.platform==='ps5'&&['ps5','ps5-pro'].includes(x.modelId))
  .map(x=>({
   model:x.modelId==='ps5-pro'?'PS5 Pro':'PS5',
   appType:x.appType==='native'?'Native PS5':x.appType==='backcompat'?'PS4-Abwärtskompatibilität':'Nicht dokumentiert',
   fps:number(x.fps,1,240),
   confidence:['official','measured','reported','unknown'].includes(x.confidence)?x.confidence:'unknown',
   modes:(Array.isArray(x.modes)?x.modes:[]).slice(0,8).map(m=>({
    name:String(m.name||'Modus').slice(0,60),targetFps:number(m.targetFps,1,240),
    resolution:typeof m.resolution==='string'?m.resolution.slice(0,70):null,
    unlocked:m.unlocked===true,vrr:m.vrr===true,
    note:typeof m.note==='string'?m.note.slice(0,180):null
   }))
  })).filter(x=>x.fps!==null&&x.modes.length);
 const evidence=(Array.isArray(record.evidence)?record.evidence:[]).slice(0,7)
  .map(x=>({url:trustedSourceUrl(x.url),title:String(x.title||x.publisher||'Beleg').slice(0,120),
   publisher:String(x.publisher||'').slice(0,60)})).filter(x=>x.url);
 const patch=(Array.isArray(record.patches)?record.patches:[]).find(x=>x.changedFps===true&&trustedSourceUrl(x.url));
 return entries.length?{slug:record.slug,syncedAt:snapshot.syncedAt||null,
  lastVerified:iso(record.lastVerified),entries,evidence,
  patch:patch?{version:String(patch.version||'').slice(0,30),date:iso(patch.date),
   previousFps:number(patch.previousFps,1,240),newFps:number(patch.newFps,1,240),
   url:trustedSourceUrl(patch.url)}:null}:null;
}
function storeUrl(url){
 try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='store.playstation.com'
 &&u.pathname.startsWith('/en-us/product/')&&!u.username&&!u.password&&!u.port?u.href:null}catch{return null}
}
export function storeSnapshotFor(title,listing,date){
 if(!Array.isArray(listing))return [];
 const key=titleKey(title);
 if(key.length<3)return [];
 return listing.filter(row=>titleKey(row?.name)===key).slice(0,8)
 .map(row=>({
  title:String(row.name||'').slice(0,140),
  platform:Array.isArray(row.platforms)?row.platforms.filter(x=>['PS4','PS5'].includes(x)).join(' / '):'',
  usdPrice:typeof row.price==='string'&&/^\$\d{1,5}(?:\.\d{2})?$/.test(row.price)
   ?Number(row.price.slice(1)):null,
  priceLabel:String(row.price||'Nicht verfügbar').slice(0,45),
  href:storeUrl(row.href),
  observedAt:typeof date==='string'&&Number.isFinite(Date.parse(date))?date:null,
  region:'US',currency:'USD',source:GAME_INTEL_SOURCES.store
 })).filter(x=>x.href);
}
export async function getFramePatchSnapshot(title,{load=loadJson}={}){
 const records=await load(URL_FPS,{maxBytes:MAX});
 return {source:GAME_INTEL_SOURCES.fps,sourceUrl:'https://framepatch.app',
  match:fpsEvidenceFor(title,records)};
}
export async function getStoreCatalogSnapshot(title,{load=loadJson}={}){
 const letter=gameSlug(title).charAt(0);
 if(!/^[a-z]$/.test(letter))return {source:GAME_INTEL_SOURCES.store,region:'US',matches:[]};
 const [listing,meta]=await Promise.all([
  load(STORE_BASE+letter+'.json',{maxBytes:1_600_000}),
  load(STORE_BASE+'%24.json',{maxBytes:2000})
 ]);
 return {source:GAME_INTEL_SOURCES.store,region:'US',snapshotAt:meta.date||null,
  matches:storeSnapshotFor(title,listing,meta.date)};
}
const hrs=seconds=>Number.isFinite(seconds)&&seconds>0&&seconds<3600*5000
 ?Math.round(seconds/3600*10)/10:null;
export function hltbCandidates(title,json){
 const data=Array.isArray(json?.data)?json.data:[];
 const key=titleKey(title);
 const candidates=data.filter(g=>g&&titleKey(g.game_name)===key).slice(0,6);
 return candidates.map(g=>({id:Number.isInteger(g.game_id)?g.game_id:null,
  title:String(g.game_name||'').slice(0,150),mainHours:hrs(g.comp_main),
  extrasHours:hrs(g.comp_plus),completionistHours:hrs(g.comp_100),
  mainSamples:number(g.comp_main_count,0,1000000),completionistSamples:number(g.comp_100_count,0,1000000),
  sourceUrl:Number.isInteger(g.game_id)?HLTB+'game/'+g.game_id:HLTB
 })).filter(x=>x.id);
}
export async function getHltbEstimates(title,{fetcher=fetch}={}){
 const ua=HLTB_UA,headers={'User-Agent':ua,Referer:HLTB};
 const init=await fetcher(HLTB+'api/search/site/init?t='+Date.now(),{
  headers,signal:AbortSignal.timeout(6000),cache:'no-store'});
 if(!init.ok)return {status:'unavailable',reason:'HLTB-Initialisierung nicht erreichbar',matches:[]};
 const key=await init.json();
 if(typeof key.token!=='string'||!key.token||
  typeof key.hpKey!=='string'||!/^[a-zA-Z0-9_]{1,60}$/.test(key.hpKey)
  ||typeof key.hpVal!=='string'||key.hpVal.length>256)
  return {status:'unavailable',reason:'HLTB-Schnittstelle geändert',matches:[]};
 const body={
  [key.hpKey]:key.hpVal,searchType:'games',searchTerms:cleanGameTitle(title).split(' '),
  searchPage:1,size:20,searchOptions:{
   games:{userId:0,platform:'',sortCategory:'popular',rangeCategory:'main',
    rangeTime:{min:0,max:0},gameplay:{perspective:'',flow:'',genre:'',difficulty:''},
    rangeYear:{min:'',max:''},modifier:'hide_dlc'},
   users:{sortCategory:'postcount'},lists:{sortCategory:'follows'},
   filter:'',sort:0,randomizer:0
  },useCache:true
 };
 const response=await fetcher(HLTB+'api/search/site',{
  method:'POST',headers:{...headers,'Content-Type':'application/json',
   Accept:'*/*','X-Auth-Token':key.token,'X-Hp-Key':key.hpKey,'X-Hp-Val':key.hpVal},
  body:JSON.stringify(body),signal:AbortSignal.timeout(6000),cache:'no-store'
 });
 if(!response.ok)return {status:'unavailable',reason:'HLTB-Anfrage abgelehnt oder eingeschränkt',matches:[]};
 const result=await response.json();
 if(!Array.isArray(result?.data))return {status:'unavailable',reason:'HLTB-Antwortformat geändert',matches:[]};
 const matches=hltbCandidates(title,result);
 return {status:matches.length?'ready':'no-match',matches};
}
export async function getGameIntelligence(title,{fps=getFramePatchSnapshot,store=getStoreCatalogSnapshot,hltb=getHltbEstimates}={}){
 const name=cleanGameTitle(title);
 if(name.length<3||name.length>125)throw Error('Invalid title');
 const values=await Promise.allSettled([fps(name),store(name),hltb(name)]);
 const result=values.map((x,i)=>x.status==='fulfilled'?x.value:({
  source:[GAME_INTEL_SOURCES.fps,GAME_INTEL_SOURCES.store,GAME_INTEL_SOURCES.hltb][i],
  status:'unavailable',error:'Datenquelle derzeit nicht erreichbar',
  matches:[]
 }));
 return {title:name,framepatch:result[0],store:result[1],howlongtobeat:result[2],
  sources:GAME_INTEL_SOURCES};
}
