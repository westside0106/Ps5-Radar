// The daily source-health recorder never stores credentials, raw vendor replies or private PSN content.
import {cloudHeaders} from './psn-cloud-helpers.mjs';
import {alertStorageConfig} from './radar-alerts-db.mjs';

const IDS=new Set(['psn','igdb','rawg','steamgriddb','profile','monitor']);
const STATES=new Set(['healthy','degraded','error','unconfigured']);
const problem=state=>state==='error'||state==='degraded';
const validDay=day=>/^\d{4}-\d{2}-\d{2}$/.test(day);
const priorDay=day=>new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);
const small=value=>String(value||'').slice(0,250);
const allowedAt=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;

export function plannedIncidentEvents(previous=[],checks=[],day=''){
 if(!validDay(day))throw Error('Invalid UTC day');
 const events=[];
 for(const c of checks){
  if(!IDS.has(c.id)||!STATES.has(c.state))continue;
  const prior=previous.filter(x=>x.source_id===c.id&&x.run_day<day).sort((a,b)=>b.run_day.localeCompare(a.run_day));
  const a=prior[0],b=prior[1];
  if(problem(c.state)&&a?.run_day===priorDay(day)&&problem(a.status)
     && !(b?.run_day===priorDay(a.run_day)&&problem(b.status))){
   events.push({id:c.id+':outage:'+a.run_day,source_id:c.id,event:'outage',status:c.state,
    detail:small('Zwei aufeinanderfolgende tägliche Prüfungen beeinträchtigt: '+c.detail)});
  }
  if(c.state==='healthy'&&a?.run_day===priorDay(day)&&problem(a.status)
      &&b?.run_day===priorDay(a.run_day)&&problem(b.status)){
   events.push({id:c.id+':recovered:'+day,source_id:c.id,event:'recovered',status:'healthy',
    detail:'Nach mindestens zwei problematischen Tagesprüfungen wieder erreichbar.'});
  }
 }
 return events;
}
export function dailyRows(checks,checkedAt){
 const day=String(checkedAt||'').slice(0,10);
 if(!validDay(day))throw Error('Invalid probe timestamp');
 return checks.filter(c=>IDS.has(c.id)&&STATES.has(c.state)).map(c=>({
  source_id:c.id,run_day:day,checked_at:checkedAt, status:c.state,detail:small(c.detail),last_data_at:allowedAt(c.lastDataAt)
 }));
}
export function sourceHealthSummary(rows=[],days=30,nowDay=new Date().toISOString().slice(0,10)){
 const start=Date.parse(nowDay+'T00:00:00Z')-(days-1)*86400000;
 return [...IDS].map(source_id=>{
  const history=rows.filter(x=>x.source_id===source_id&&Date.parse(x.run_day+'T00:00:00Z')>=start&&x.run_day<=nowDay)
    .sort((a,b)=>b.run_day.localeCompare(a.run_day));
  const good=history.filter(x=>x.status==='healthy').length;
  return {source_id,total:history.length,healthy:good,degraded:history.filter(x=>x.status==='degraded').length,
   errors:history.filter(x=>x.status==='error').length,last:history[0]||null};
 });
}
const tableNames={checks:'radar_source_health_checks',events:'radar_source_health_events',pushControl:'radar_source_push_control'};
export function sourceHistoryConfig(env=process.env){return alertStorageConfig(env)}
export async function sourceHistoryDb(config,table,query='',{method='GET',data,prefer,fetcher=fetch}={}){
 if(!config||!tableNames[table])throw Error('Private source health storage unavailable');
 const response=await fetcher(config.base+tableNames[table]+query,{
  method,headers:{...cloudHeaders(config.secret),...(prefer?{Prefer:prefer}:{})},cache:'no-store',
  signal:AbortSignal.timeout(9000),
  ...(data!==undefined?{body:JSON.stringify(data)}:{})
 });
 if(!response.ok)throw Error('Source health storage HTTP '+response.status);
 const body=await response.text();
 return body?JSON.parse(body):[];
}
export async function readSourceHistory(config,{fetcher=fetch}={}){
 const [checks,events]=await Promise.all([
  sourceHistoryDb(config,'checks','?select=source_id,run_day,checked_at,status,detail,last_data_at&order=run_day.desc&limit=600',{fetcher}),
  sourceHistoryDb(config,'events','?select=id,source_id,event,status,detail,created_at,read_at,push_sent_at,push_last_error,push_attempts&order=created_at.desc&limit=120',{fetcher})
 ]);
 return {checks,events};
}
export async function storeScheduledHealth(config,report,{fetcher=fetch}={}){
 const rows=dailyRows(report.checks,report.checkedAt);
 if(rows.length!==6)throw Error('Unexpected source count');
 const {checks:previous}=await readSourceHistory(config,{fetcher});
 const day=rows[0].run_day;
 // The unique (source_id,run_day) key makes duplicate scheduler invocations harmless.
 await sourceHistoryDb(config,'checks','?on_conflict=source_id,run_day',{
  method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',data:rows,fetcher
 });
 const events=plannedIncidentEvents(previous,report.checks,day);
 if(events.length)await sourceHistoryDb(config,'events','?on_conflict=id',{
  method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',data:events,fetcher
 });
 return {recorded:rows.length,incidentCandidates:events.length,day};
}
export async function markSourceEventRead(config,id,{fetcher=fetch,now=new Date()}={}){
 if(typeof id!=='string'||!/^(?:psn|igdb|rawg|steamgriddb|profile|monitor):(outage|recovered):\d{4}-\d{2}-\d{2}$/.test(id))throw Error('Invalid incident ID');
 const query='?id=eq.'+encodeURIComponent(id)+'&read_at=is.null';
 return sourceHistoryDb(config,'events',query,{method:'PATCH',data:{read_at:now.toISOString()},prefer:'return=representation',fetcher});
}
