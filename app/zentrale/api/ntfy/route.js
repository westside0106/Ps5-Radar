import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {sourceHistoryConfig} from '../../../../lib/source-health-history.mjs';
import {ntfyConfig,ntfyTestMessage,publishNtfy,reservePushTest} from '../../../../lib/ntfy-source-push.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=15;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers});
async function authed(){
 const expected=sessionToken();
 const jar=await cookies();
 return Boolean(expected&&safeEqual(jar.get(COOKIE_NAME)?.value,expected));
}
export async function GET(){
 if(!await authed())return json({error:'Nicht angemeldet'},401);
 const config=ntfyConfig();
 if(!config)return json({configured:false,provider:'ntfy'});
 // The secret topic is only visible to the authenticated owner, never in a public page.
 return json({configured:true,provider:'ntfy',server:config.origin,topic:config.topic,
  warning:'ntfy.sh ist ein öffentlicher Topic-Dienst. Ausschließlich allgemeine Statusmeldungen.'});
}
export async function POST(request){
 if(!await authed())return json({error:'Nicht angemeldet'},401);
 // Cookie-based write actions need explicit same-origin protection.
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin)return json({error:'Anfrageursprung nicht zulässig'},403);
 const channel=ntfyConfig(),storage=sourceHistoryConfig();
 if(!channel||!storage)return json({error:'Push nicht eingerichtet'},503);
 try{
  const allowed=await reservePushTest(storage);
  if(!allowed)return json({error:'Testversand höchstens alle zehn Minuten möglich'},429);
 }catch{return json({error:'Testlimit kann nicht überprüft werden'},503)}
 try{
  await publishNtfy(channel,ntfyTestMessage());
  return json({accepted:true,message:'Testnachricht von ntfy angenommen. Empfang am iPhone bitte prüfen.'});
 }catch{return json({error:'ntfy hat die Testnachricht nicht angenommen'},502)}
}
