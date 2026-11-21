import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {sourceHistoryConfig} from '../../../../lib/source-health-history.mjs';
import {readSourceScanRuns} from '../../../../lib/source-scan-audit.mjs';
import {readWatchdogHistory} from '../../../../lib/source-cron-watchdog.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(data,status=200)=>Response.json(data,{status,headers});
async function authenticated(){
 const expected=sessionToken();
 const jar=await cookies();
 return Boolean(expected&&safeEqual(jar.get(COOKIE_NAME)?.value,expected));
}
export async function GET(){
 if(!await authenticated())return respond({error:'Nicht angemeldet'},401);
 const storage=sourceHistoryConfig();
 if(!storage)return respond({error:'Privater Prüfspeicher nicht verfügbar'},503);
 try{
  const [runs,scheduledRuns,watchdogDays]=await Promise.all([
   readSourceScanRuns(storage,{limit:60}),
   readSourceScanRuns(storage,{limit:45,kind:'scheduled'}),
   readWatchdogHistory(storage,{limit:45})
  ]);
  return respond({configured:true,runs,scheduledRuns,watchdogDays,
   schedule:{hourUtc:9,graceMinutes:60,watchdogHourUtc:11,watchdogMinuteUtc:15}});
 }catch{return respond({error:'Prüfprotokoll nicht erreichbar'},503)}
}
