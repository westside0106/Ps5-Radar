import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {lookupTrophyGuides} from '../../../../lib/psn-trophy-guide-index.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request){
 const expected=sessionToken(),jar=await cookies();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))
  return Response.json({error:'Nicht angemeldet'},{status:401,headers});
 const title=new URL(request.url).searchParams.get('title')||'';
 if(title.trim().length<3||title.length>125)
  return Response.json({error:'Ungültiger Spielname'},{status:400,headers});
 try{
  return Response.json(await lookupTrophyGuides(title),{headers});
 }catch{
  return Response.json({error:'Externer Guide-Index derzeit nicht erreichbar. Manuelle Guide-Suche bleibt verfügbar.'},
   {status:503,headers});
 }
}
