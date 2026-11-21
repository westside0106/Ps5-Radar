import {timingSafeEqual} from 'node:crypto';
import {checkSourceHealth} from '../../../../lib/source-health.mjs';
import {sourceHistoryConfig,storeScheduledHealth} from '../../../../lib/source-health-history.mjs';
import {deliverPendingNtfy,ntfyConfig} from '../../../../lib/ntfy-source-push.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const secure={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request){
 const configured=process.env.CRON_SECRET;
 const received=request.headers.get('authorization')||'';
 const expected='Bearer '+configured;
 if(!configured||configured.length<20||received.length!==expected.length
     ||!timingSafeEqual(Buffer.from(received),Buffer.from(expected)))
  return Response.json({error:'Unauthorized'},{status:401,headers:secure});
 const config=sourceHistoryConfig();
 if(!config)return Response.json({error:'Private status storage unavailable'},{status:503,headers:secure});
 try{
  const report=await checkSourceHealth({useCache:false});
  const saved=await storeScheduledHealth(config,report);
  let push;
  try{push=await deliverPendingNtfy(config,ntfyConfig(),{limit:5})}
  catch{push={configured:Boolean(ntfyConfig()),attempted:0,accepted:0,failed:1,deliveryError:true}}
  // A failure of the optional notification service must not erase the completed
  // source-health scan or misrepresent an unsuccessful push as delivered.
  return Response.json({ok:true,...saved,checkedAt:report.checkedAt,summary:report.summary,push},{headers:secure});
 }catch{
  return Response.json({error:'Scheduled status scan failed'},{status:503,headers:secure});
 }
}
