// Read-only multi-region discovery. No Sony credentials, purchase actions or
// cross-currency "cheapest" assertions. Based on imbbloh/ps-prices (GitHub).
// An on-demand third-party server, not the official PlayStation Store API.
const PROVIDER_URL='https://ps-prices-api.onrender.com/prices';
export const REGION_PRICE_SOURCE='imbbloh/ps-prices';
export const REGION_PRICE_SOURCE_URL='https://github.com/imbbloh/ps-prices';
export const REGIONAL_STORES=Object.freeze([
 {region:'DE',locale:'de-de',currency:'EUR',label:'Deutschland'},
 {region:'GB',locale:'en-gb',currency:'GBP',label:'Großbritannien'},
 {region:'US',locale:'en-us',currency:'USD',label:'USA'},
 {region:'PL',locale:'pl-pl',currency:'PLN',label:'Polen'}
]);
const byRegion=new Map(REGIONAL_STORES.map(x=>[x.region,x]));
const cache=new Map();
const TTL=15*60*1000;
const MAX_CACHE=50;
const number=(x,max=50000)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max?x:null;
export const validRegionQuery=title=>typeof title==='string'&&title.trim().length>=3
 &&title.trim().length<=120&&!/[\u0000-\u001f\u007f]/.test(title);
export function selectedStoreIdentity(raw){
 if(typeof raw!=='string'||raw.length>320)return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.hostname!=='store.playstation.com'||u.port||u.username||u.password
   ||u.search||u.hash)return null;
  const [,locale,type,id,...rest]=u.pathname.split('/');
  if(rest.length||!REGIONAL_STORES.some(x=>x.locale===locale)
   ||(type!=='concept'&&type!=='product'))return null;
  if(type==='concept'&&/^\d{5,12}$/.test(id))
   return {type:'concept',value:id};
  if(type==='product'&&/^[A-Z]{2}\d{4}-[A-Z0-9_-]{5,70}$/.test(id))
   return {type:'product',value:id};
  return null;
 }catch{return null}
}
function verifiedStorePage(url,region){
 if(typeof url!=='string'||url.length>400)return null;
 try{
  const u=new URL(url),r=byRegion.get(region);
  if(!r||u.protocol!=='https:'||u.hostname!=='store.playstation.com'
   ||u.username||u.password||u.port||u.search||u.hash)return null;
  if(!u.pathname.startsWith('/'+r.locale+'/'))return null;
  if(!/^\/[a-z]{2}-[a-z]{2}\/(?:product\/[A-Za-z0-9_%-]+|concept\/\d{5,12})\/?$/.test(u.pathname))return null;
  return u.href;
 }catch{return null}
}
export function normalizeRegionalResults(payload,{title='',identity=null,observedAt=new Date().toISOString()}={}){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)
  ||!Array.isArray(payload.results)||payload.results.length>30)
  throw Error('Invalid external regional response');
 const uid=identity?.type==='concept'?identity.value:null;
 const found=typeof payload.conceptId==='string'&&/^\d{5,12}$/.test(payload.conceptId)
  ?payload.conceptId:null;
 const identityMatched=Boolean(uid&&found&&found===uid);
 const titleMatch=typeof title==='string'&&typeof payload.title==='string'
  &&title.normalize('NFKC').toLocaleLowerCase('de').trim()===payload.title.normalize('NFKC').toLocaleLowerCase('de').trim();
 const officialLink=Boolean(identityMatched);
 const rows=new Map();
 for(const r of payload.results){
  if(!r||typeof r!=='object'||Array.isArray(r)||!byRegion.has(r.region)
   ||rows.has(r.region))continue;
  const region=byRegion.get(r.region),url=verifiedStorePage(r.url,r.region);
  const curr=r.currency===region.currency;
  const questionable=Boolean(r.suspect||r.redirected||r.foreign||r.adjusted);
  const price=curr&&url&&!questionable&&number(r.price)!==null&&r.price>0?number(r.price):null;
  const original=price!==null?number(r.original):null;
  const discount=price!==null&&original!==null&&original>price
   ?Math.round((1-price/original)*100):null;
  rows.set(r.region,{
   region:region.region,label:region.label,currency:region.currency,
   price,original:discount!==null?original:null,discountPct:discount,
   link:url,
   sourceMode:['concept','product','search'].includes(r.via)?r.via:'unknown',
   evidence:price===null?(questionable?'suspect':'unavailable'):'provider-reported',
   english:r.english===true?'yes':r.english===false?'no':'unknown',
   suspicious:questionable,
   editionsCount:Array.isArray(r.editions)?Math.min(r.editions.length,40):null,
   storeUrlVerified:Boolean(url)
  });
 }
 return {
  source:REGION_PRICE_SOURCE,sourceUrl:REGION_PRICE_SOURCE_URL,
  title:typeof payload.title==='string'?payload.title.slice(0,130):title,
  match:identityMatched?'concept-id':titleMatch?'title-review':'unverified-review',
  reviewRequired:true,conceptId:found,
  observedAt,providerCached:payload.cached===true,
  identityInput:identity?.type||'title',
  // Never mark third-party prices as verified Sony purchase offers.
  status:rows.size?'provider-results':'no-results',
  rows:REGIONAL_STORES.map(x=>rows.get(x.region)||{
   region:x.region,label:x.label,currency:x.currency,price:null,original:null,
   discountPct:null,link:null,sourceMode:'none',evidence:'unavailable',
   english:'unknown',suspicious:false,editionsCount:null,storeUrlVerified:false
  }),
  note:'Drittanbieter-Abfrage, kein offizieller Sony-Livepreis; Kontoregion, Edition und Kaufpreis im Store prüfen.'
 };
}
export async function fetchRegionalPrices(title,{
 storeUrl=null,fetcher=fetch,now=()=>Date.now()
}={}){
 if(!validRegionQuery(title))throw Error('Invalid game title');
 const identity=selectedStoreIdentity(storeUrl);
 // Only explicit Sony Store identity from supplied metadata can be used.
 const term=identity?.value||title.trim();
 const key=(identity?.type||'title')+':'+term.toLocaleLowerCase('en');
 const ts=now(),hit=cache.get(key);
 if(hit?.until>ts)return {...hit.value,providerCached:true};
 if(hit?.promise)return hit.promise;
 const promise=(async()=>{
  let response;
  try{
   const url=PROVIDER_URL+'?title='+encodeURIComponent(term);
   response=await fetcher(url,{
    headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(42000),cache:'no-store',redirect:'error'
   });
  }catch{return {status:'unavailable',reason:'Externer Regionaldienst nicht erreichbar',source:REGION_PRICE_SOURCE,rows:[]}}
  if(!response?.ok)return {status:'unavailable',reason:'Regionaldienst liefert keine verwertbare Antwort',source:REGION_PRICE_SOURCE,rows:[]};
  const size=Number(response.headers?.get?.('content-length'));
  if(size>350000)return {status:'unavailable',reason:'Antwort zu groß',source:REGION_PRICE_SOURCE,rows:[]};
  let payload;
  try{
   const body=await response.text();
   if(body.length>350000)throw Error('Too large');
   payload=JSON.parse(body);
   if(payload?.error)throw Error('Upstream no result');
   const result=normalizeRegionalResults(payload,{title,identity,observedAt:new Date(now()).toISOString()});
   if(result.status==='provider-results'){
    cache.set(key,{value:result,until:now()+TTL});
    if(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
   }
   return result;
  }catch{return {status:'unavailable',reason:'Regionaldaten nicht eindeutig lesbar',source:REGION_PRICE_SOURCE,rows:[]}}
 })();
 cache.set(key,{promise});
 try{return await promise}finally{
  const entry=cache.get(key);
  if(entry?.promise===promise)cache.delete(key);
 }
}
