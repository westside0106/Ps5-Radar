import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {getGameIntelligence} from '../../../../lib/psn-game-intelligence.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=45;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request){
 const expected=sessionToken(),jar=await cookies();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))
  return Response.json({error:'Nicht angemeldet'},{status:401,headers});
 const title=new URL(request.url).searchParams.get('title')||'';
 if(title.trim().length<3||title.length>125)
  return Response.json({error:'Ungültiger Spielname'},{status:400,headers});
 try{
  const result=await getGameIntelligence(title);
  return Response.json(result,{headers});
 }catch{
  return Response.json({error:'Datenabruf nicht möglich'},{status:503,headers});
 }
}
