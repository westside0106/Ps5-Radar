// Sampled evidence about scheduled source jobs (not continuous uptime).
// Missing historic receipts are unknown, NOT proof of a missed execution.
export const SOURCE_CRON_START_UTC_MINUTE=9*60;
export const SOURCE_CRON_END_UTC_MINUTE=10*60;
export const WATCHDOG_START_UTC_MINUTE=11*60+15;
export const WATCHDOG_END_UTC_MINUTE=12*60+15;

const toDay=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const time=Date.parse(value+'T00:00:00.000Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?value:null;
};
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))
 ?Date.parse(value):null;
const fromUtcMs=value=>new Date(value).toISOString().slice(0,10);
const dayMinute=value=>{const t=new Date(value);return t.getUTCHours()*60+t.getUTCMinutes()};
const withinSourceWindow=t=>dayMinute(t)>=SOURCE_CRON_START_UTC_MINUTE
 &&dayMinute(t)<SOURCE_CRON_END_UTC_MINUTE;

export function sourceCronTimeline(runs=[],watchdogs=[],{
 now=new Date(),days=7
}={}){
 if(!Array.isArray(runs)||!Array.isArray(watchdogs)||![7,30].includes(days)
  ||!(now instanceof Date)||!Number.isFinite(now.getTime()))
  throw Error('Invalid cron timeline request');
 const anchor=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 const scheduled=runs.filter(x=>x?.run_kind==='scheduled'
   &&timestamp(x.started_at)!==null);
 const validWatchdogs=watchdogs.filter(x=>toDay(x?.run_day));
 const byDay=new Map(validWatchdogs.map(x=>[x.run_day,x]));
 const rows=Array.from({length:days},(_,index)=>{
  const date=fromUtcMs(anchor-index*86400000);
  const starts=scheduled.filter(x=>fromUtcMs(timestamp(x.started_at))===date)
   .sort((a,b)=>timestamp(a.started_at)-timestamp(b.started_at));
  const watchdog=byDay.get(date)||null;
  const successful=starts.find(x=>x.result==='success');
  const failed=starts.find(x=>x.result==='failed');
  const running=starts.find(x=>x.result==='running');
  const reference=successful||failed||running||starts[0]||null;
  const nowDay=fromUtcMs(anchor);
  let status;
  if(successful)status='success';
  else if(failed)status='failed';
  else if(running)status=now.getTime()-timestamp(running.started_at)>=5*60000?'unfinished':'running';
  else if(watchdog){
   status=watchdog.status==='missing'?'missing'
    :watchdog.status==='unconfirmed'||watchdog.status==='ok'?'unconfirmed'
    :watchdog.status==='failed'?'unconfirmed'
    :watchdog.status==='unfinished'?'unconfirmed':'unknown';
  }else if(date===nowDay){
   const m=dayMinute(now);
   status=m<SOURCE_CRON_START_UTC_MINUTE?'upcoming'
    :m<SOURCE_CRON_END_UTC_MINUTE?'window'
    :m<WATCHDOG_END_UTC_MINUTE?'awaiting_watchdog'
    :'unconfirmed';
  }else status='unknown';
  // The earliest actual source-Cron receipt is the representative start time.
  // On Vercel Hobby all start times between 09:00 and 10:00 UTC are in-window.
  const first=starts[0]||null;
  const timing=first?(withinSourceWindow(timestamp(first.started_at))?'within_window':'outside_window'):null;
  const count=starts.length;
  const warn=watchdog&&watchdog.status!=='ok';
  return {day:date,status,timing,starts:count,first,reference,
   watchdog:watchdog?{status:watchdog.status,checkedAt:watchdog.checked_at,
    pushAccepted:Boolean(watchdog.push_sent_at),
    pushAttempted:Number(watchdog.push_attempts)||0,
    pushError:watchdog.push_last_error||null}:null,
   warning:Boolean(warn),
   hasCronReceipt:count>0,
   hasWatchdogReceipt:Boolean(watchdog)};
 });
 return {anchorDay:fromUtcMs(anchor),days,rows,
  summary:{
   withCronReceipt:rows.filter(x=>x.hasCronReceipt).length,
   successful:rows.filter(x=>x.status==='success').length,
   failedOrUnfinished:rows.filter(x=>['failed','unfinished'].includes(x.status)).length,
   noCronProof:rows.filter(x=>['missing','unconfirmed'].includes(x.status)).length,
   withoutDayEvidence:rows.filter(x=>x.status==='unknown').length,
   withWatchdogReceipt:rows.filter(x=>x.hasWatchdogReceipt).length,
   watchdogWarnings:rows.filter(x=>x.warning).length,
   outsideCronWindow:rows.filter(x=>x.timing==='outside_window').length
  }};
}
export const sourceCronLabel={
 success:'Erfolgreich',failed:'Fehlgeschlagen',unfinished:'Ohne Abschluss',
 running:'Läuft',missing:'Kein Cron-Nachweis',unconfirmed:'Nicht bestätigt',
 unknown:'Keine historischen Daten',upcoming:'Noch nicht fällig',
 window:'Cron-Zeitfenster läuft',awaiting_watchdog:'Wächterprüfung ausstehend'
};
export const watchdogVerdictLabel={
 ok:'Bestätigt',failed:'Fehlgeschlagen',unfinished:'Ohne Abschluss',
 missing:'Kein Cron protokolliert',unconfirmed:'Nicht eindeutig belegbar'
};
