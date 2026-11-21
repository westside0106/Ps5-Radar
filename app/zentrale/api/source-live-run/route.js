import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {sourceHistoryConfig} from '../../../../lib/source-health-history.mjs';
import {reserveManualSourceScan,runLiveSourceScan} from '../../../../lib/source-live-ops.mjs';
import {auditedSourceRun} from '../../../../lib/source-scan-audit.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(data,status=200)=>Response.json(data,{status,headers});
async function authenticated(){
 const expected=sessionToken();
 const jar=await cookies();
 return Boolean(expected&&safeEqual(jar.get(COOKIE_NAME)?.value,expected));
}
export async function POST(request){
 if(!await authenticated())return respond({error:'Nicht angemeldet'},401);
 // Session-cookie writes must reject cross-origin requests.
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin)
  return respond({error:'Anfrageursprung nicht zulässig'},403);
 const config=sourceHistoryConfig();
 if(!config)return respond({error:'Privater Quellen-Speicher nicht erreichbar'},503);
 try{
  const reserved=await reserveManualSourceScan(config);
  if(!reserved)return respond({error:'Die nächste Sofortprüfung ist nach zehn Minuten möglich.',cooldownSeconds:600},429);
 }catch{return respond({error:'Prüflimit kann nicht gesichert werden'},503)}
 try{
  return respond(await auditedSourceRun(config,'manual',()=>runLiveSourceScan(config)));
 }catch{
  return respond({error:'Sofortprüfung fehlgeschlagen; nächster Versuch nach Ablauf des Prüflimits.'},503);
 }
}
