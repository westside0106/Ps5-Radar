import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {checkSourceHealth} from '../../../../lib/source-health.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};

export async function GET(){
 const expected=sessionToken();
 const jar=await cookies();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))
  return Response.json({error:'Nicht angemeldet'},{status:401,headers});
 try{
  return Response.json(await checkSourceHealth(),{headers});
 }catch{
  return Response.json({error:'Diagnose derzeit nicht verfügbar'},{status:503,headers});
 }
}
