import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {fetchRegionalPrices,validRegionQuery,selectedStoreIdentity} from '../../../../lib/psn-region-price-compare.mjs';

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
