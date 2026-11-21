// Private server-only independent watchdog for the 09:00 UTC source-health cron.
// Conclusions are a daily snapshot at/after 11:00 UTC, not continuous monitoring.
import {randomUUID} from 'node:crypto';
import {sourceHistoryDb} from './source-health-history.mjs';
import {publishNtfy} from './ntfy-source-push.mjs';

const STATES=new Set(['ok','failed','unfinished','missing','unconfirmed']);
export const WATCHDOG_HOUR_UTC=11;
const MINUTE_MS=60000;
const DAY_MS=86400000;
const RADAR_URL='https://playstation-radar-private.vercel.app/zentrale?tab=quellen';

function utcDay(now){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid watchdog timestamp');
 return now.toISOString().slice(0,10);
}
function dayBounds(day){
 const start=new Date(day+'T00:00:00.000Z');
 return [start.toISOString(),new Date(start.getTime()+DAY_MS).toISOString()];
}
export function watchdogConclusion(runs=[],dailySources=0,{now=new Date()}={}){
 if(!Array.isArray(runs)||!Number.isFinite(now.getTime()))throw Error('Invalid watchdog inputs');
 const [start,end]=dayBounds(utcDay(now));
 const today=runs.filter(r=>r?.run_kind==='scheduled' && typeof r.started_at==='string' &&
  r.started_at>=start && r.started_at<end);
 const completed=today.some(x=>x.result==='success');
 if(completed)return {status:'ok',scheduledRuns:today.length,dailySources};
 if(today.some(x=>x.result==='failed'))
  return {status:'failed',scheduledRuns:today.length,dailySources};
 const running=today.filter(x=>x.result==='running');
 if(running.length){
  if(running.some(x=>now.getTime()-Date.parse(x.started_at)<5*MINUTE_MS))
   return {status:'pending',scheduledRuns:today.length,dailySources};
  return {status:'unfinished',scheduledRuns:today.length,dailySources};
 }
 return {status:dailySources===6?'unconfirmed':'missing',
  scheduledRuns:today.length,dailySources};
}
export function watchdogPushMessage(row){
 if(!row || !STATES.has(row.status) || row.status==='ok'
     || !/^\d{4}-\d{2}-\d{2}$/.test(row.run_day))
  throw Error('Invalid watchdog notice');
 const reason={
  missing:'kein automatischer Quellencheck protokolliert',
  failed:'der automatische Quellencheck ist fehlgeschlagen',
  unfinished:'ein Quellencheck wurde ohne Abschluss protokolliert',
  unconfirmed:'die Cron-Ausfuehrung konnte nicht bestaetigt werden'
 }[row.status];
 return {
  title:'PS5-Radar: Tagescheck pruefen',
  body:'Status vom '+row.run_day+': '+reason+'. Details nur im privaten Radar.',
  priority:row.status==='failed'?'4':'3',tags:'warning',click:RADAR_URL
 };
}
export async function readWatchdogHistory(config,{db=sourceHistoryDb,limit=21}={}){
 if(!config)throw Error('Private watchdog storage missing');
 const n=Math.min(60,Math.max(1,Math.trunc(Number(limit)||21)));
 const rows=await db(config,'watchdog',
  '?select=run_day,checked_at,status,scheduled_runs,daily_sources,push_sent_at,push_attempts,push_last_error&order=run_day.desc&limit='+n);
 if(!Array.isArray(rows))throw Error('Unexpected watchdog rows');
 return rows;
}
export async function inspectScheduledSourceRun(config,{db=sourceHistoryDb,now=new Date()}={}){
 if(!config)throw Error('Private watchdog storage missing');
 const day=utcDay(now);
 const [start,end]=dayBounds(day);
 const runs=await db(config,'runs',
  '?select=run_kind,result,started_at&run_kind=eq.scheduled&started_at=gte.'+encodeURIComponent(start)
  +'&started_at=lt.'+encodeURIComponent(end)+'&order=started_at.desc&limit=100');
 const checks=await db(config,'checks','?select=source_id&run_day=eq.'+day+'&limit=6');
 if(!Array.isArray(runs)||!Array.isArray(checks))throw Error('Watchdog source history unavailable');
 const unique=new Set(checks.map(x=>x.source_id));
 const today=watchdogConclusion(runs,Math.min(unique.size,6),{now});
 return {day,...today};
}
export async function deliverWatchdogNtfy(config,ntfy,{
 db=sourceHistoryDb,send=publishNtfy,now=new Date(),makeId=randomUUID,limit=6
}={}){
 if(!ntfy)return {configured:false,attempted:0,accepted:0,failed:0};
 const rows=await db(config,'watchdog',
  '?select=run_day,status,push_attempts,push_sent_at,push_lease_until&status=neq.ok&push_sent_at=is.null&order=run_day.asc&limit='+Math.min(10,Math.max(1,Math.trunc(limit))) );
 if(!Array.isArray(rows))throw Error('Watchdog pending queue unavailable');
 let attempted=0,accepted=0,failed=0;
 for(const item of rows){
  if(!STATES.has(item.status)||item.status==='ok')continue;
  const token=makeId();
  const lockedUntil=new Date(now.getTime()+10*MINUTE_MS).toISOString();
  const q='?run_day=eq.'+item.run_day+'&push_sent_at=is.null&or=(push_lease_until.is.null,push_lease_until.lt.'+encodeURIComponent(now.toISOString())+')';
  const claimed=await db(config,'watchdog',q,{
   method:'PATCH',prefer:'return=representation',
   data:{push_lease_until:lockedUntil,push_lease_token:token,push_attempts:Math.min(100000,(item.push_attempts||0)+1)}
  });
  if(!Array.isArray(claimed)||!claimed.length)continue;
  attempted++;
  const ackQuery='?run_day=eq.'+item.run_day+'&push_lease_token=eq.'+token+'&push_sent_at=is.null';
  try{
   await send(ntfy,watchdogPushMessage(item));
   const ack=await db(config,'watchdog',ackQuery,{
    method:'PATCH',prefer:'return=representation',
    data:{push_sent_at:new Date().toISOString(),push_lease_token:null,push_lease_until:null,push_last_error:null}
   });
   if(!Array.isArray(ack)||ack.length!==1)throw Error('Watchdog push acknowledgement conflict');
   accepted++;
  }catch(error){
   failed++;
   try{await db(config,'watchdog',ackQuery,{
    method:'PATCH',prefer:'return=minimal',
    data:{push_last_error:/^ntfy HTTP \d{3}$/.test(error?.message||'')?'http_rejection':'transport_or_ack_failed'}
   })}catch{/* lease remains, allowing a later retry */}
  }
 }
 return {configured:true,attempted,accepted,failed};
}
export async function runSourceCronWatchdog(config,{
 db=sourceHistoryDb,now=new Date(),ntfy=null,send=publishNtfy
}={}){
 if(!config)throw Error('Private watchdog storage missing');
 const day=utcDay(now);
 // Vercel Hobby cron may start at any time within its scheduled hour.
 // Evaluate only after the entire source-cron window (09:00–10:00 UTC).
 if(now.getUTCHours()<WATCHDOG_HOUR_UTC)return {ok:true,status:'not_due',day,stored:false};
 const view=await inspectScheduledSourceRun(config,{db,now});
 if(view.status==='pending')return {ok:true,status:'pending',day,stored:false};
 if(!STATES.has(view.status))throw Error('Unexpected watchdog verdict');
 const records=await db(config,'watchdog','?on_conflict=run_day',{
  method:'POST',prefer:'resolution=ignore-duplicates,return=representation',
  data:{run_day:day,checked_at:now.toISOString(),status:view.status,
   scheduled_runs:Math.min(100,view.scheduledRuns),daily_sources:view.dailySources}
 });
 if(!Array.isArray(records))throw Error('Watchdog verdict could not be confirmed');
 let selected=records[0];
 if(!selected){
  const existing=await db(config,'watchdog','?select=run_day,status&run_day=eq.'+day+'&limit=1');
  if(!Array.isArray(existing)||existing.length!==1||!STATES.has(existing[0].status))
   throw Error('Watchdog stored verdict unavailable');
  selected=existing[0];
 }
 let push;
 try{push=await deliverWatchdogNtfy(config,ntfy,{db,now,send});}
 catch{push={configured:Boolean(ntfy),attempted:0,accepted:0,failed:1,deliveryError:true};}
 return {ok:true,status:selected.status,day,stored:true,newRecord:records.length===1,push};
}
