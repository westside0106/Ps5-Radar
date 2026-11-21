import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {MAX_MONITOR_CSV_BYTES,parsePsnMonitorCsv,validMonitorZone} from '../../../../lib/psn-monitor-import.mjs';
import {monitorStorageConfig,readMonitorSnapshot,saveMonitorSnapshot} from '../../../../lib/psn-monitor-cloud-server.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const safeHeaders={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers:safeHeaders});

async function hasRadarSession(){
 const expected=sessionToken();
 if(!expected)return false;
 const jar=await cookies();
 return safeEqual(jar.get(COOKIE_NAME)?.value,expected);
}
function hasPushToken(request){
 const expected=process.env.PSN_MONITOR_PUSH_TOKEN;
 if(!expected||!(/^[0-9a-f]{64,128}$/i.test(expected)))return false;
 const authorization=request.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return false;
 return safeEqual(authorization.slice(7),expected);
}

export async function GET(){
 if(!await hasRadarSession())return json({error:'Nicht angemeldet'},401);
 const config=monitorStorageConfig();
 if(!config)return json({configured:false,error:'Monitor-Cloud nicht konfiguriert'},503);
 try{
  const snapshot=await readMonitorSnapshot(config);
  return json({configured:true,connected:Boolean(snapshot),
   sessions:snapshot?.sessions||[],revision:snapshot?.revision??0,
   receivedAt:snapshot?.receivedAt||null,timeZone:snapshot?.timeZone||null,
   rowCount:snapshot?.rowCount??0,warningCounts:snapshot?.warningCounts||{}});
 }catch{return json({error:'Monitor-Speicher nicht verfügbar'},503)}
}

export async function POST(request){
 // A dedicated machine-to-machine token is mandatory. This route never accepts
 // a Radar browser session as authority to upload server-side observations.
 if(!process.env.PSN_MONITOR_PUSH_TOKEN)return json({error:'Monitor-Push nicht eingerichtet'},503);
 if(!hasPushToken(request))return json({error:'Nicht autorisiert'},401);
 const config=monitorStorageConfig(),timeZone=process.env.PSN_MONITOR_TIME_ZONE;
 if(!config||!validMonitorZone(timeZone))return json({error:'Monitor-Push: Server-Konfiguration unvollständig'},503);
 if(!/^text\/csv(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json({error:'CSV im Format text/csv erforderlich'},415);
 const size=Number(request.headers.get('content-length')||0);
 if(Number.isFinite(size)&&size>MAX_MONITOR_CSV_BYTES)return json({error:'CSV größer als 2 MB'},413);
 let csv;
 try{
  csv=await request.text();
  if(Buffer.byteLength(csv,'utf8')>MAX_MONITOR_CSV_BYTES)return json({error:'CSV größer als 2 MB'},413);
 }catch{return json({error:'CSV konnte nicht gelesen werden'},400)}
 let parsed;
 try{
  parsed=parsePsnMonitorCsv(csv,{timeZone});
 }catch{return json({error:'CSV-Inhalt oder Format ungültig'},400)}
 try{
  const saved=await saveMonitorSnapshot(config,parsed);
  return json({ok:true,added:saved.added,total:saved.total,
   revision:saved.revision,receivedAt:saved.receivedAt,warnings:parsed.warningCounts});
 }catch(error){
  return json({error:error?.status===409?'Versionskonflikt – erneut versuchen':'Monitor-Speicher nicht verfügbar'},error?.status===409?409:503);
 }
}
