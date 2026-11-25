// Server-side only. A separate immutable-category evidence ledger;
// never merge or forward these observations into EUR price-alert rules.
import {createHash} from 'node:crypto';
import {cloudHeaders} from './psn-cloud-helpers.mjs';
import {REGIONAL_STORES,REGION_PRICE_SOURCE,selectedStoreIdentity,validRegionQuery}
 from './psn-region-price-compare.mjs';

const PERIOD_DAYS=90;
const TABLE='psn_regional_price_history';
const REGIONS=new Map(REGIONAL_STORES.map(x=>[x.region,x.currency]));
const safeDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
 &&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&
 new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

export function regionalHistoryConfig(env=process.env){
 const host=env.SUPABASE_URL,secret=env.SUPABASE_SECRET_KEY;
 if(typeof host!=='string'||typeof secret!=='string'||!secret)return null;
 try{
  const url=new URL(host);
  if(url.protocol!=='https:'||!(/^[a-z0-9-]+\.supabase\.co$/i).test(url.hostname)
   ||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
  return {url:url.origin+'/rest/v1/'+TABLE,secret};
 }catch{return null}
}
export function regionalHistoryIdentity(title,storeUrl=null){
 if(!validRegionQuery(title))return null;
 const identity=selectedStoreIdentity(storeUrl);
 const normalized=title.normalize('NFKC').trim().replace(/\s+/g,' ');
 const part=identity?identity.type+':'+identity.value:'title:'+normalized.toLowerCase();
 const key='reg-'+createHash('sha256').update(part,'utf8').digest('hex');
 return {key,title:normalized,lookupType:identity?.type||'title'};
}
export function acceptedRegionalObservations(result,identity){
 if(!identity||result?.status!=='provider-results'||!Array.isArray(result.rows)
  ||!['concept-id','title-review'].includes(result.match))return [];
 const moment=Date.parse(result.observedAt);
 if(!Number.isFinite(moment))return [];
 const observedAt=new Date(moment).toISOString();
 const observedDay=observedAt.slice(0,10);
 const out=[];
 for(const row of result.rows){
  const region=REGIONS.get(row?.region);
  const price=row?.price;
  if(!region||row.currency!==region||row.evidence!=='provider-reported'
   ||row.suspicious||!Number.isFinite(price)||price<=0||price>50000
   ||typeof row.link!=='string'||!row.link.startsWith('https://store.playstation.com/')
   ||out.some(x=>x.region===row.region))continue;
  const original=Number.isFinite(row.original)&&row.original>price&&row.original<=50000
   ?Math.round(row.original*100)/100:null;
  const discount=original!==null&&Number.isInteger(row.discountPct)&&row.discountPct>=1
   &&row.discountPct<=99?row.discountPct:null;
  out.push({
   game_key:identity.key,title:identity.title,lookup_type:identity.lookupType,
   match_quality:result.match,region:row.region,currency:region,
   price:Math.round(price*100)/100,original_price:discount!==null?original:null,
   discount_pct:discount,store_url:row.link,source:REGION_PRICE_SOURCE,
   source_type:'external-unverified',observed_day:observedDay,
   observed_at:observedAt,provider_cached:result.providerCached===true
  });
 }
 return out;
}
const headers=config=>cloudHeaders(config.secret);

export async function recordRegionalPriceObservation(config,result,identity,{fetcher=fetch}={}){
 const rows=acceptedRegionalObservations(result,identity);
 if(!rows.length)return {saved:0,reason:'Kein hinreichend zugeordneter, plausibler Anbieterpreis'};
 if(!config)return {saved:0,reason:'Privater Cloud-Speicher nicht eingerichtet'};
 const response=await fetcher(config.url+'?on_conflict=game_key,region,observed_day',{
  method:'POST',
  headers:{...headers(config),Prefer:'resolution=merge-duplicates,return=minimal'},
  body:JSON.stringify(rows),cache:'no-store'
 });
 if(!response.ok)throw Error('Regionaler Verlaufspeicher nicht beschreibbar');
 return {saved:rows.length,observedDay:rows[0].observed_day};
}
export function summarizeRegionalHistory(raw,identity,{now=new Date()}={}){
 if(!Array.isArray(raw)||!identity)return {points:[],days:0,source:REGION_PRICE_SOURCE};
 const earliest=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())
  -(PERIOD_DAYS-1)*86400000;
 const points=raw.filter(row=>
  row?.game_key===identity.key&&REGIONS.get(row?.region)===row.currency
  &&Number.isFinite(Number(row?.price))&&Number(row.price)>0&&Number(row.price)<=50000
  &&safeDate(row.observed_day)&&Date.parse(row.observed_day+'T00:00:00Z')>=earliest
  &&row.source===REGION_PRICE_SOURCE&&row.source_type==='external-unverified'
 ).map(row=>({
  day:row.observed_day,region:row.region,currency:row.currency,
  price:Number(row.price),discountPct:Number.isInteger(row.discount_pct)?row.discount_pct:null,
  match:row.match_quality,observedAt:row.observed_at
 })).sort((a,b)=>a.day.localeCompare(b.day)||a.region.localeCompare(b.region)).slice(-360);
 const days=new Set(points.map(x=>x.day)).size;
 return {points,days,source:REGION_PRICE_SOURCE,periodDays:PERIOD_DAYS,
  sampleCount:points.length,firstDay:points[0]?.day||null,
  lastDay:points.at(-1)?.day||null,
  disclaimer:'Drittanbieter-Messpunkte; keine garantierten Sony-Kaufpreise und keine EUR-Preisalarmquelle.'};
}
export async function readRegionalPriceHistory(config,identity,{
 fetcher=fetch,now=new Date()
}={}){
 if(!identity)return summarizeRegionalHistory([],identity,{now});
 if(!config)throw Error('Privater Cloud-Speicher nicht eingerichtet');
 const since=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())
  -(PERIOD_DAYS-1)*86400000).toISOString().slice(0,10);
 const uri=config.url+'?game_key=eq.'+identity.key+'&observed_day=gte.'+since
  +'&select=game_key,region,currency,price,discount_pct,match_quality,observed_at,observed_day,source,source_type'
  +'&order=observed_day.asc&limit=360';
 const response=await fetcher(uri,{headers:headers(config),cache:'no-store'});
 if(!response.ok)throw Error('Regionaler Verlaufspeicher nicht lesbar');
 const data=await response.json();
 if(!Array.isArray(data)||data.length>360)throw Error('Ungültiger Regionalverlauf');
 return summarizeRegionalHistory(data,identity,{now});
}
