import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {getPsnGameTrophies} from '../../../../lib/psn-server.mjs';
export const dynamic='force-dynamic';
export async function GET(request){
 const jar=await cookies(),expected=sessionToken();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))return Response.json({error:'Nicht angemeldet'},{status:401});
 const url=new URL(request.url),id=url.searchParams.get('id')||'',service=url.searchParams.get('service')||'trophy';
 try{const trophies=await getPsnGameTrophies(id,service,url.searchParams.get('fresh')==='1');return Response.json({trophies},{headers:{'Cache-Control':'private, no-store'}});}
 catch(e){return Response.json({error:e.message||'Trophäen nicht verfügbar'},{status:502});}
}
