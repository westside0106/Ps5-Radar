// Server-only access to a dedicated private Supabase monitor table.
// Never import this file from a client component. The table is not part of
// psn_private_profile: automatic uploads must not race manual profile backups.
import {cloudHeaders} from './psn-cloud-helpers.mjs';
import {mergeObservedSessions,normalizeObservedSessions} from './psn-monitor-import.mjs';

export function monitorStorageConfig(env=process.env){
 const host=env.SUPABASE_URL,secret=env.SUPABASE_SECRET_KEY;
 if(!host||!secret)return null;
 try{
  const parsed=new URL(host);
  if(parsed.protocol!=='https:'||!(/^[a-z0-9-]+[.]supabase[.]co$/i.test(parsed.hostname))||parsed.port||parsed.username||parsed.password||parsed.pathname!=='/')return null;
  return {url:parsed.origin+'/rest/v1/psn_monitor_snapshot',secret};
 }catch{return null}
}
function settings(config,extra={}){
 return {...cloudHeaders(config.secret),...extra};
}
export async function readMonitorSnapshot(config,{fetcher=fetch}={}){
 const response=await fetcher(config.url+'?id=eq.default&select=id,sessions,revision,received_at,time_zone,row_count,warning_counts',{
  headers:settings(config),cache:'no-store'
 });
 if(!response.ok)throw new Error('Monitor-Speicher nicht lesbar');
 const rows=await response.json();
 if(!Array.isArray(rows))throw new Error('Ungültige Monitor-Antwort');
 const row=rows[0];
 if(!row)return null;
 return {
  sessions:normalizeObservedSessions(row.sessions),
  revision:Number.isSafeInteger(row.revision)?row.revision:Number(row.revision),
  receivedAt:row.received_at,
  timeZone:typeof row.time_zone==='string'?row.time_zone:'',
  rowCount:Number(row.row_count)||0,
  warningCounts:row.warning_counts&&typeof row.warning_counts==='object'&&!Array.isArray(row.warning_counts)?row.warning_counts:{}
 };
}
export async function saveMonitorSnapshot(config,parsed,{fetcher=fetch,now=new Date()}={}){
 const fresh=normalizeObservedSessions(parsed.sessions);
 const receivedAt=now.toISOString();
 for(let attempt=0;attempt<4;attempt++){
  const current=await readMonitorSnapshot(config,{fetcher});
  const before=current?.sessions||[];
  const merged=mergeObservedSessions(before,fresh);
  if(Buffer.byteLength(JSON.stringify(merged),'utf8')>=900000)throw new Error('Monitor-Kontingent überschritten');
  const seen=new Set(before.map(x=>x.id));
  const added=fresh.filter(x=>!seen.has(x.id)&&merged.some(y=>y.id===x.id)).length;
  const previousRevision=current?.revision??0;
  if(!Number.isSafeInteger(previousRevision)||previousRevision<0)throw new Error('Ungültige Monitor-Revision');
  const values={
   sessions:merged,revision:previousRevision+1,received_at:receivedAt,
   time_zone:parsed.timeZone,row_count:parsed.rows,warning_counts:parsed.warningCounts||{}
  };
  const isUpdate=Boolean(current);
  const url=isUpdate?config.url+'?id=eq.default&revision=eq.'+previousRevision:config.url;
  const response=await fetcher(url,{
   method:isUpdate?'PATCH':'POST',headers:settings(config,{Prefer:'return=representation'}),
   body:JSON.stringify(isUpdate?values:{id:'default',...values}),cache:'no-store'
  });
  if(response.status===409)continue; // concurrent insert
  if(!response.ok)throw new Error('Monitor-Speicher nicht beschreibbar');
  const rows=await response.json();
  if(!Array.isArray(rows))throw new Error('Ungültige Monitor-Speicherantwort');
  if(!rows.length)continue; // concurrent optimistic PATCH returned no rows
  return {added,total:merged.length,revision:previousRevision+1,receivedAt};
 }
 const e=new Error('Monitor-Speicher: Versionskonflikt, später erneut versuchen');
 e.status=409;
 throw e;
}
