import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {alertDb,alertSnapshot,alertStorageConfig} from '../../../../lib/radar-alerts-db.mjs';
import {validatedRule} from '../../../../lib/radar-price-alerts.mjs';
import {scanPriceAlerts} from '../../../../lib/radar-price-alert-scan.mjs';
import priceHistory from '../../../../data/price-history.json';

export const dynamic='force-dynamic';
const secure={'Cache-Control':'private, no-store'};
async function authed(){
 const jar=await cookies(),token=sessionToken();
 return Boolean(token&&safeEqual(jar.get(COOKIE_NAME)?.value,token));
}
async function authorized(){
 if(!await authed())return {error:Response.json({error:'Nicht angemeldet'},{status:401,headers:secure})};
 const config=alertStorageConfig();
 if(!config)return {error:Response.json({configured:false,error:'Privater Preisspeicher nicht eingerichtet'},{status:503,headers:secure})};
 return {config};
}
export async function GET(){
 const {config,error}=await authorized();if(error)return error;
 try{return Response.json({configured:true,...await alertSnapshot(config)},{headers:secure})}
 catch{return Response.json({error:'Preisalarm-Datenbank momentan nicht erreichbar'},{status:503,headers:secure})}
}
export async function POST(request){
 const {config,error}=await authorized();if(error)return error;
 let raw;try{raw=await request.json()}catch{return Response.json({error:'Ungültige Anfrage'},{status:400,headers:secure})}
 const rule=validatedRule(raw,Object.keys(priceHistory.games||{}));
 if(!rule)return Response.json({error:'Wähle einen unterstützten Preisradar-Titel und gültigen Euro-Zielpreis.'},{status:400,headers:secure});
 try{
  await alertDb(config,'radar_price_alert_rules','?on_conflict=title',{
   method:'POST',data:{...rule,last_match_key:null,last_status:'unverified',updated_at:new Date().toISOString()},
   prefer:'resolution=merge-duplicates,return=minimal'
  });
  return Response.json({saved:true},{headers:secure});
 }catch{return Response.json({error:'Preisregel konnte nicht gespeichert werden'},{status:503,headers:secure})}
}
export async function DELETE(request){
 const {config,error}=await authorized();if(error)return error;
 let raw;try{raw=await request.json()}catch{return Response.json({error:'Ungültige Anfrage'},{status:400,headers:secure})}
 const title=String(raw?.title||'');
 if(!Object.hasOwn(priceHistory.games||{},title))return Response.json({error:'Unbekannter Titel'},{status:400,headers:secure});
 try{
  await alertDb(config,'radar_price_alert_rules','?title=eq.'+encodeURIComponent(title),{method:'DELETE'});
  return Response.json({deleted:true},{headers:secure});
 }catch{return Response.json({error:'Regel konnte nicht entfernt werden'},{status:503,headers:secure})}
}
export async function PATCH(request){
 const {config,error}=await authorized();if(error)return error;
 let raw;try{raw=await request.json()}catch{return Response.json({error:'Ungültige Anfrage'},{status:400,headers:secure})}
 const id=String(raw?.id||'');
 if(!/^price-[a-f0-9]{64}$/.test(id))return Response.json({error:'Ungültige Meldungs-ID'},{status:400,headers:secure});
 try{
  await alertDb(config,'radar_price_notifications','?id=eq.'+id+'&read_at=is.null',{
   method:'PATCH',data:{read_at:new Date().toISOString()},prefer:'return=minimal'
  });
  return Response.json({read:true},{headers:secure});
 }catch{return Response.json({error:'Meldung konnte nicht markiert werden'},{status:503,headers:secure})}
}
// Manual check, explicitly initiated in the authenticated UI. The same logic runs by cron.
export async function PUT(){
 const {config,error}=await authorized();if(error)return error;
 try{return Response.json({ok:true,...await scanPriceAlerts({config,source:priceHistory})},{headers:secure})}
 catch{return Response.json({error:'Prüfung nicht verfügbar'},{status:503,headers:secure})}
}
