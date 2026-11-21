import {timingSafeEqual} from 'node:crypto';
import {sourceHistoryConfig} from '../../../../lib/source-health-history.mjs';
import {runSourceCronWatchdog} from '../../../../lib/source-cron-watchdog.mjs';
import {ntfyConfig} from '../../../../lib/ntfy-source-push.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=45;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 const received=request.headers.get('authorization')||'';
 const expected='Bearer '+secret;
 if(!secret||secret.length<20||received.length!==expected.length||
  !timingSafeEqual(Buffer.from(received),Buffer.from(expected)))
  return Response.json({error:'Unauthorized'},{status:401,headers});
 const storage=sourceHistoryConfig();
 if(!storage)return Response.json({error:'Private watchdog storage unavailable'},{status:503,headers});
 try{
  const result=await runSourceCronWatchdog(storage,{ntfy:ntfyConfig()});
  return Response.json(result,{headers});
 }catch{
  return Response.json({error:'Watchdog evaluation unavailable'},{status:503,headers});
 }
}
