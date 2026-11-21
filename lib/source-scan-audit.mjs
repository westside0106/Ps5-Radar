// Server-only audit of actual scan executions. Never store raw exceptions,
// provider responses, credentials, account identifiers or game data.
import {randomUUID} from 'node:crypto';
import {sourceHistoryDb} from './source-health-history.mjs';

const KINDS=new Set(['scheduled','manual']);
const bounded=(value,max)=>Number.isFinite(Number(value))
 ?Math.min(max,Math.max(0,Math.trunc(Number(value)))):null;

function completionFields(report){
 const status=report?.summary||{};
 const saved=report?.stored||report||{};
 const push=report?.push||{};
 return {
  healthy_count:bounded(status.healthy,6),
  degraded_count:bounded(status.degraded,6),
  error_count:bounded(status.error,6),
  unconfigured_count:bounded(status.unconfigured,6),
  daily_inserted:bounded(saved.inserted,6),
  latest_updated:bounded(saved.updated,6),
  push_accepted:bounded(push.accepted,10),
  push_failed:bounded(push.failed,10)
 };
}

export async function auditedSourceRun(config,kind,execute,{
 db=sourceHistoryDb,clock=()=>new Date(),makeId=randomUUID
}={}){
 if(!config||!KINDS.has(kind)||typeof execute!=='function')
  throw Error('Invalid scan audit invocation');
 const id=makeId();
 const started=clock();
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||!Number.isFinite(started?.getTime?.()))
  throw Error('Invalid scan audit identity');
 const startedAt=started.toISOString();
 let startedRecorded=false;
 try{
  await db(config,'runs','',{method:'POST',prefer:'return=minimal',data:{
   id,run_kind:kind,started_at:startedAt,result:'running'
  }});
  startedRecorded=true;
 }catch{
  // An audit storage outage must not suppress the actual source-health check.
 }
 async function finalize(result,report){
  if(!startedRecorded)return false;
  const end=clock();
  const finishedAt=Number.isFinite(end?.getTime?.())?end.toISOString():new Date().toISOString();
  const milliseconds=Math.max(0,Math.min(600000,Date.parse(finishedAt)-started.getTime()));
  const fields=result==='success'?completionFields(report):{failure_code:'scan_failed'};
  try{
   const writes=await db(config,'runs','?id=eq.'+encodeURIComponent(id)+'&result=eq.running',{
    method:'PATCH',prefer:'return=representation',
    data:{result,finished_at:finishedAt,duration_ms:milliseconds,...fields}
   });
   return Array.isArray(writes)&&writes.length===1;
  }catch{return false}
 }
 try{
  const result=await execute();
  const recorded=await finalize('success',result);
  return {...result,audit:{recorded}};
 }catch(error){
  await finalize('failed');
  throw error;
 }
}

export async function readSourceScanRuns(config,{db=sourceHistoryDb,limit=60,kind=null}={}){
 if(!config)throw Error('Private scan audit storage missing');
 const boundedLimit=Math.min(120,Math.max(1,Math.trunc(Number(limit)||60)));
 if(kind!==null&&kind!=='scheduled'&&kind!=='manual')throw Error('Invalid source scan audit kind');
 const query='?select=id,run_kind,started_at,finished_at,result,duration_ms,healthy_count,degraded_count,error_count,unconfigured_count,daily_inserted,latest_updated,push_accepted,push_failed,failure_code'
  +(kind?'&run_kind=eq.'+kind:'')
  +'&order=started_at.desc&limit='+boundedLimit;
 const rows=await db(config,'runs',query);
 if(!Array.isArray(rows))throw Error('Invalid source scan audit response');
 return rows;
}
