import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {sourceHistoryConfig} from '../../../../lib/source-health-history.mjs';
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
 const config=sourceHistoryConfig();
 if(!config)return respond({error:'Privater Watchdog-Speicher nicht verfügbar'},503);
 try{
  const days=await readWatchdogHistory(config,{limit:21});
  return respond({configured:true,days,schedule:{sourceHourUtc:9,watchdogHourUtc:11,watchdogMinuteUtc:15}});
 }catch{return respond({error:'Watchdog-Verlauf nicht erreichbar'},503)}
}
