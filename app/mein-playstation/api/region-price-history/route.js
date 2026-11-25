import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {validRegionQuery,selectedStoreIdentity} from '../../../../lib/psn-region-price-compare.mjs';
import {regionalHistoryConfig,regionalHistoryIdentity,readRegionalPriceHistory} from '../../../../lib/psn-regional-price-history.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const secure={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request){
 const jar=await cookies(),expected=sessionToken();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))
  return Response.json({error:'Nicht angemeldet'},{status:401,headers:secure});
 const url=new URL(request.url),title=url.searchParams.get('title')||'';
 const storeUrl=url.searchParams.get('storeUrl');
 if(!validRegionQuery(title)||storeUrl!==null&&storeUrl.length>320)
  return Response.json({error:'Ungültige Spielzuordnung'},{status:400,headers:secure});
 const identity=regionalHistoryIdentity(title,selectedStoreIdentity(storeUrl)?storeUrl:null);
 if(!identity)return Response.json({error:'Ungültige Spielzuordnung'},{status:400,headers:secure});
 const config=regionalHistoryConfig();
 if(!config)return Response.json({configured:false,history:null},{headers:secure});
 try{
  return Response.json({configured:true,history:await readRegionalPriceHistory(config,identity)},
   {headers:secure});
 }catch{
  return Response.json({configured:true,history:null,error:'Privates Regionalarchiv nicht erreichbar'},
   {status:503,headers:secure});
 }
}
