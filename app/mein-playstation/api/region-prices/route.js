import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {fetchRegionalPrices,validRegionQuery,selectedStoreIdentity} from '../../../../lib/psn-region-price-compare.mjs';
import {regionalHistoryConfig,regionalHistoryIdentity,recordRegionalPriceObservation,readRegionalPriceHistory} from '../../../../lib/psn-regional-price-history.mjs';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const secure={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request){
 const jar=await cookies(),expected=sessionToken();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))
  return Response.json({error:'Nicht angemeldet'},{status:401,headers:secure});
 const url=new URL(request.url),title=url.searchParams.get('title')||'';
 const storeUrl=url.searchParams.get('storeUrl');
 if(!validRegionQuery(title)||storeUrl!==null&&storeUrl.length>320)
  return Response.json({error:'Ungültiger Spieletitel oder Store-Link'},{status:400,headers:secure});
 try{
  const result=await fetchRegionalPrices(title,{storeUrl:selectedStoreIdentity(storeUrl)?storeUrl:null});
  return Response.json(result,{headers:secure});
 }catch{
  return Response.json({error:'Regionalvergleich derzeit nicht erreichbar'},{status:503,headers:secure});
 }
}

export async function POST(request){
 const jar=await cookies(),expected=sessionToken();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))
  return Response.json({error:'Nicht angemeldet'},{status:401,headers:secure});
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)
  return Response.json({error:'Unzulässiger Ursprung'},{status:403,headers:secure});
 const raw=await request.text();
 if(raw.length>1250)return Response.json({error:'Anfrage zu groß'},{status:413,headers:secure});
 let body;try{body=JSON.parse(raw)}catch{return Response.json({error:'Ungültige Anfrage'},{status:400,headers:secure})}
 const title=body?.title,storeUrl=body?.storeUrl||null;
 if(!validRegionQuery(title)||storeUrl!==null&&(typeof storeUrl!=='string'||storeUrl.length>320)
  ||body.saveHistory!==true)
  return Response.json({error:'Ungültiger Spieletitel oder Archivierungsauftrag'},{status:400,headers:secure});
 const identity=regionalHistoryIdentity(title,selectedStoreIdentity(storeUrl)?storeUrl:null);
 if(!identity)return Response.json({error:'Ungültige Spielzuordnung'},{status:400,headers:secure});
 const config=regionalHistoryConfig();
 let result;
 try{result=await fetchRegionalPrices(title,{storeUrl:selectedStoreIdentity(storeUrl)?storeUrl:null})}
 catch{return Response.json({error:'Regionen konnten nicht abgefragt werden'},{status:503,headers:secure})}
 let archived={configured:Boolean(config),saved:0};
 if(config){
  try{
   const receipt=await recordRegionalPriceObservation(config,result,identity);
   archived={configured:true,...receipt};
  }catch{archived={configured:true,saved:0,error:'Private Preisbeobachtung konnte nicht gespeichert werden'}}
  try{
   archived.history=await readRegionalPriceHistory(config,identity);
  }catch{archived.historyError='Gespeicherter Preisverlauf derzeit nicht lesbar'}
 }
 return Response.json({...result,archive:archived},{headers:secure});
}
