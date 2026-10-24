import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {getPsnGameGallery} from '../../../../lib/psn-game-metadata.mjs';

export const dynamic='force-dynamic';
export async function GET(request){
  const jar=await cookies(),expected=sessionToken();
  if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))
    return Response.json({error:'Nicht angemeldet'},{status:401});
  const title=new URL(request.url).searchParams.get('title')||'';
  if(title.length<3||title.length>125)
    return Response.json({error:'Ungültiger Spielname'},{status:400});
  const result=await getPsnGameGallery(title);
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
}
