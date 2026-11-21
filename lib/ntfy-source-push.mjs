// Private, server-only ntfy sender with a leased, at-least-once outbox.
// Public ntfy.sh topics are readable: NEVER send personal PSN data or raw diagnostic details.
import {randomUUID} from 'node:crypto';
import {sourceHistoryDb} from './source-health-history.mjs';

const EVENTS=/^(?:psn|igdb|rawg|steamgriddb|profile|monitor):(outage|recovered):\d{4}-\d{2}-\d{2}$/;
const NAMES={psn:'PlayStation Network',igdb:'IGDB',rawg:'RAWG',steamgriddb:'SteamGridDB',profile:'Supabase-Spielwelt',monitor:'Supabase-PSN-Monitor'};
const RADAR_URL='https://playstation-radar-private.vercel.app/zentrale?tab=quellen';
const LEASE_MS=10*60*1000;
const TEST_INTERVAL_MS=10*60*1000;

export function ntfyConfig(env=process.env){
 const topic=env.NTFY_TOPIC;
 if(typeof topic!=='string'||!(/^[a-z0-9][a-z0-9_-]{23,63}$/i.test(topic)))return null;
 try{
  const url=new URL(env.NTFY_SERVER_URL||'https://ntfy.sh');
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.port||!url.hostname||url.hostname==='localhost')return null;
  const authToken=typeof env.NTFY_AUTH_TOKEN==='string'&&/^tk_[a-zA-Z0-9_-]{10,200}$/.test(env.NTFY_AUTH_TOKEN)?env.NTFY_AUTH_TOKEN:null;
  return {origin:url.origin,topic,authToken};
 }catch{return null}
}
export function ntfyEventMessage(event){
 if(!EVENTS.test(event?.id||'')||!(event.source_id in NAMES))throw Error('Invalid source event');
 const outage=event.event==='outage';
 if(event.event!=='outage'&&event.event!=='recovered')throw Error('Invalid event kind');
 return {
  title:outage?'PS5-Radar: Stoerung erkannt':'PS5-Radar: Quelle wieder erreichbar',
  body:(outage?'Wiederholte Probleme bei ':'Wiederhergestellt: ')+NAMES[event.source_id]+'. Details nur im geschuetzten Radar.',
  priority:outage?'4':'3',tags:outage?'warning':'white_check_mark',
  click:RADAR_URL
 };
}
export function ntfyTestMessage(){
 return {
  title:'PS5-Radar: Push-Test',
  body:'Testnachricht vom privaten Quellen-Monitor. Es wurden keine PSN-Kontodaten uebertragen.',
  priority:'3',tags:'white_check_mark',click:RADAR_URL
 };
}
export async function publishNtfy(config,message,{fetcher=fetch}={}){
 if(!config||!message?.body)throw Error('ntfy not configured');
 const url=config.origin+'/'+encodeURIComponent(config.topic);
 const headers={
  'Content-Type':'text/plain; charset=utf-8',
  'Title':message.title,'Priority':message.priority,'Tags':message.tags,
  'Click':message.click,
  ...(config.authToken?{Authorization:'Bearer '+config.authToken}:{})
 };
 const response=await fetcher(url,{
  method:'POST',headers,body:message.body,cache:'no-store',signal:AbortSignal.timeout(5000)
 });
 if(!response.ok)throw Error('ntfy HTTP '+response.status);
 return {accepted:true};
}
function claimQuery(event,now){
 return '?id=eq.'+encodeURIComponent(event.id)+'&push_sent_at=is.null&or=(push_lease_until.is.null,push_lease_until.lt.'+encodeURIComponent(now.toISOString())+')';
}
export async function deliverPendingNtfy(storage,ntfy,{db=sourceHistoryDb,fetcher=fetch,now=new Date(),limit=5}={}){
 if(!storage)throw Error('Missing source-history storage');
 if(!ntfy)return {configured:false,attempted:0,accepted:0,failed:0,pending:null};
 const rows=await db(storage,'events','?select=id,source_id,event,status,push_sent_at,push_lease_until,push_attempts&push_sent_at=is.null&order=created_at.asc&limit='+Math.min(Math.max(1,limit),10));
 if(!Array.isArray(rows))throw Error('Invalid pending outbox response');
 let accepted=0,failed=0,attempted=0,skipped=0;
 for(const item of rows){
  if(!EVENTS.test(item?.id||'')){skipped++;continue}
  const token=randomUUID();
  const until=new Date(now.getTime()+LEASE_MS).toISOString();
  const claims=await db(storage,'events',claimQuery(item,now),{
   method:'PATCH',prefer:'return=representation',
   data:{push_lease_until:until,push_lease_token:token,push_attempts:Math.min(99999,Math.max(0,Number(item.push_attempts)||0)+1)}
  });
  if(!Array.isArray(claims)||claims.length===0){skipped++;continue}
  attempted++;
  const releaseQuery='?id=eq.'+encodeURIComponent(item.id)+'&push_lease_token=eq.'+token+'&push_sent_at=is.null';
  try{
   await publishNtfy(ntfy,ntfyEventMessage(item),{fetcher});
   const saved=await db(storage,'events',releaseQuery,{
    method:'PATCH',prefer:'return=representation',
    data:{push_sent_at:new Date().toISOString(),push_lease_until:null,push_lease_token:null,push_last_error:null}
   });
   if(!Array.isArray(saved)||!saved.length)throw Error('Delivery acknowledgement conflict');
   accepted++;
  }catch(error){
   failed++;
   const reason=/^ntfy HTTP (\d{3})$/.exec(error?.message||'');
   // Do not store raw provider errors; a later daily cron may retry after the lease expires.
   try{await db(storage,'events',releaseQuery,{
    method:'PATCH',prefer:'return=minimal',
    data:{push_last_error:reason?'HTTP '+reason[1]:'Transport/acknowledgement failed'}
   })}catch{/* The stale lease can expire safely. */}
  }
 }
 return {configured:true,attempted,accepted,failed,skipped,pending:rows.length};
}
export async function reservePushTest(storage,{db=sourceHistoryDb,now=new Date()}={}){
 const before=new Date(now.getTime()-TEST_INTERVAL_MS).toISOString();
 const result=await db(storage,'pushControl','?id=eq.default&last_test_at=lt.'+encodeURIComponent(before),{
  method:'PATCH',prefer:'return=representation',data:{last_test_at:now.toISOString()}
 });
 if(!Array.isArray(result))throw Error('Push-test throttle unavailable');
 return result.length>0;
}
