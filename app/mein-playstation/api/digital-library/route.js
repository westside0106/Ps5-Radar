import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {getPsnDigitalLibrary} from '../../../../lib/psn-server.mjs';
export const dynamic='force-dynamic';
export async function GET(){
 const jar=await cookies(),expected=sessionToken();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))return Response.json({error:'Nicht angemeldet'},{status:401});
 try{return Response.json(await getPsnDigitalLibrary(),{headers:{'Cache-Control':'private, no-store'}})}
 catch(e){return Response.json({error:e.message||'PSN-Bibliothek nicht verfügbar'},{status:502})}
}
