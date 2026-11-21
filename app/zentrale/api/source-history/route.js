import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {readSourceHistory,markSourceEventRead,sourceHistoryConfig,sourceHealthSummary} from '../../../../lib/source-health-history.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const secure={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(data,status=200)=>Response.json(data,{status,headers:secure});
async function authed(){
 const expected=sessionToken();
 const jar=await cookies();
 return Boolean(expected&&safeEqual(jar.get(COOKIE_NAME)?.value,expected));
}
export async function GET(){
 if(!await authed())return respond({error:'Nicht angemeldet'},401);
 const config=sourceHistoryConfig();
 if(!config)return respond({configured:false,checks:[],events:[],transitions:[],summary:[]},503);
 try{
  const record=await readSourceHistory(config);
  return respond({configured:true,checks:record.checks,events:record.events,transitions:record.transitions,
   summary:sourceHealthSummary(record.checks,30)});
 }catch{return respond({error:'Statushistorie derzeit nicht erreichbar'},503)}
}
export async function PATCH(request){
 if(!await authed())return respond({error:'Nicht angemeldet'},401);
 const config=sourceHistoryConfig();
 if(!config)return respond({error:'Privater Statusspeicher fehlt'},503);
 let body;
 try{body=await request.json()}catch{return respond({error:'Ungültige Anfrage'},400)}
 if(typeof body?.id!=='string'||body.id.length>110)return respond({error:'Ungültige Meldungskennung'},400);
 try{
  const rows=await markSourceEventRead(config,body.id);
  return respond({ok:true,updated:rows.length>0});
 }catch(e){
  if(e.message==='Invalid incident ID')return respond({error:'Ungültige Meldungskennung'},400);
  return respond({error:'Meldung konnte nicht bestätigt werden'},503);
 }
}
