// Authenticated, on-demand provider diagnostics. Never expose credentials or raw provider bodies.
import {getPsnDashboard} from './psn-server.mjs';
import {cloudHeaders} from './psn-cloud-helpers.mjs';
import {monitorStorageConfig} from './psn-monitor-cloud-server.mjs';

const CACHE_MS=60_000;
const MONITOR_STALE_MS=60*60*1000;
let cached=null;
const displayNames={
 psn:'PlayStation Network',
 igdb:'IGDB / Twitch',
 rawg:'RAWG',
 steamgriddb:'SteamGridDB',
 profile:'Supabase · Spielwelt',
 monitor:'Supabase · PSN-Monitor'
};
function row(id,state,detail,extra={}){
 return {id,name:displayNames[id],state,detail,...extra};
}
function failure(id,response){
 if(response?.status===429)return row(id,'degraded','API-Limit erreicht (HTTP 429).');
 if(response?.status===401||response?.status===403)return row(id,'error','Authentifizierung abgewiesen (HTTP '+response.status+').');
 if(response?.status>=500)return row(id,'error','Anbieterfehler (HTTP '+response.status+').');
 return row(id,'error','Anfrage fehlgeschlagen (HTTP '+(response?.status||'?')+').');
}
const unavailable=id=>row(id,'error','Anbieter nicht erreichbar oder Anfrage abgebrochen.');
async function http(fetcher,url,options={}){
 return fetcher(url,{...options,cache:'no-store',signal:AbortSignal.timeout(6500)});
}
async function psnCheck(env,reader){
 if(!env.PSN_NPSSO)return row('psn','unconfigured','PSN_NPSSO nicht eingerichtet.');
 try{
  const data=await reader({force:true});
  if(!data?.connected)return row('psn','degraded','PSN-Konfiguration vorhanden, aber kein bestätigter Datenabruf.');
  if(data.errors?.length)return row('psn','degraded',data.errors.length+' Teilbereich(e) fehlgeschlagen.',{lastDataAt:data.checkedAt||null});
  return row('psn','healthy','Private PSN-Daten erfolgreich abgerufen.',{lastDataAt:data.checkedAt||null});
 }catch{return unavailable('psn')}
}
async function igdbCheck(env,fetcher){
 if(!env.IGDB_CLIENT_ID&&!env.IGDB_CLIENT_SECRET)return row('igdb','unconfigured','IGDB-Anmeldedaten fehlen.');
 if(!env.IGDB_CLIENT_ID||!env.IGDB_CLIENT_SECRET)return row('igdb','degraded','IGDB-Anmeldedaten unvollständig.');
 try{
  const auth=await http(fetcher,'https://id.twitch.tv/oauth2/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({client_id:env.IGDB_CLIENT_ID,client_secret:env.IGDB_CLIENT_SECRET,grant_type:'client_credentials'})
  });
  if(!auth.ok)return failure('igdb',auth);
  const token=(await auth.json())?.access_token;
  if(typeof token!=='string'||!token)return row('igdb','error','Twitch hat keinen nutzbaren Zugriffstoken geliefert.');
  const test=await http(fetcher,'https://api.igdb.com/v4/games',{
   method:'POST',headers:{'Client-ID':env.IGDB_CLIENT_ID,Authorization:'Bearer '+token,'Content-Type':'text/plain'},
   body:'fields id; limit 1;'
  });
  if(!test.ok)return failure('igdb',test);
  if(!Array.isArray(await test.json()))return row('igdb','degraded','IGDB antwortet in einem unerwarteten Format.');
  return row('igdb','healthy','OAuth und IGDB-Abfrage erfolgreich.');
 }catch{return unavailable('igdb')}
}
async function rawgCheck(env,fetcher){
 if(!env.RAWG_API_KEY)return row('rawg','unconfigured','RAWG_API_KEY nicht eingerichtet.');
 try{
  const u=new URL('https://api.rawg.io/api/games');
  u.search=new URLSearchParams({key:env.RAWG_API_KEY,page_size:'1'}).toString();
  const response=await http(fetcher,u.toString());
  if(!response.ok)return failure('rawg',response);
  if(!Array.isArray((await response.json())?.results))return row('rawg','degraded','RAWG-Antwort unvollständig.');
  return row('rawg','healthy','Authentifizierter RAWG-Abruf erfolgreich.');
 }catch{return unavailable('rawg')}
}
async function steamCheck(env,fetcher){
 if(!env.STEAMGRIDDB_API_KEY)return row('steamgriddb','unconfigured','STEAMGRIDDB_API_KEY nicht eingerichtet.');
 try{
  const response=await http(fetcher,'https://www.steamgriddb.com/api/v2/search/autocomplete/PlayStation',{
   headers:{Authorization:'Bearer '+env.STEAMGRIDDB_API_KEY}
  });
  if(!response.ok)return failure('steamgriddb',response);
  if(!Array.isArray((await response.json())?.data))return row('steamgriddb','degraded','SteamGridDB-Antwort unvollständig.');
  return row('steamgriddb','healthy','Authentifizierter Metadatenabruf erfolgreich.');
 }catch{return unavailable('steamgriddb')}
}
async function cloudCheck(id,env,fetcher,now){
 if(!env.SUPABASE_URL&&!env.SUPABASE_SECRET_KEY)return row(id,'unconfigured','Cloud-Speicher nicht konfiguriert.');
 const config=monitorStorageConfig(env);
 if(!config)return row(id,'degraded','Cloud-Speicher-Konfiguration unvollständig oder ungültig.');
 const table=id==='profile'?'psn_private_profile':'psn_monitor_snapshot';
 const select=id==='profile'?'id':'received_at';
 try{
  const response=await http(fetcher,new URL('/rest/v1/'+table+'?select='+select+'&limit=1',env.SUPABASE_URL).toString(),{
   headers:cloudHeaders(config.secret)
  });
  if(!response.ok)return failure(id,response);
  const rows=await response.json();
  if(!Array.isArray(rows))return row(id,'degraded','Cloud-Antwort hat ein unerwartetes Format.');
  if(id==='profile')return row(id,'healthy',rows.length?'Profilspeicher erreichbar.':'Profilspeicher erreichbar; noch kein Profil vorhanden.');
  if(!rows.length)return row(id,'degraded','Monitor-Speicher erreichbar, aber noch kein Upload vorhanden.');
  const received=rows[0]?.received_at, ms=typeof received==='string'?Date.parse(received):NaN;
  if(!Number.isFinite(ms)||ms>now+300000)return row(id,'degraded','Upload-Zeitpunkt fehlt oder ist ungültig.');
  const ageMinutes=Math.max(0,Math.floor((now-ms)/60000));
  return row(id,now-ms>MONITOR_STALE_MS?'degraded':'healthy',
   now-ms>MONITOR_STALE_MS?'Letzter Monitor-Upload älter als 60 Minuten.':'Letzter Monitor-Upload innerhalb von 60 Minuten.',
   {lastDataAt:new Date(ms).toISOString(),ageMinutes});
 }catch{return unavailable(id)}
}
export function healthSummary(checks=[]){
 const count=state=>checks.filter(x=>x.state===state).length;
 return {healthy:count('healthy'),degraded:count('degraded'),error:count('error'),unconfigured:count('unconfigured')};
}
export async function checkSourceHealth({env=process.env,fetcher=fetch,psnReader=getPsnDashboard,now=Date.now(),useCache=true}={}){
 if(useCache&&cached&&now-cached.at>=0&&now-cached.at<CACHE_MS)return cached.data;
 const checks=await Promise.all([
  psnCheck(env,psnReader),igdbCheck(env,fetcher),rawgCheck(env,fetcher),
  steamCheck(env,fetcher),cloudCheck('profile',env,fetcher,now),cloudCheck('monitor',env,fetcher,now)
 ]);
 const checkedAt=new Date(now).toISOString();
 const result={checkedAt,cacheSeconds:60,checks,summary:healthSummary(checks),backgroundMonitoring:false};
 if(useCache)cached={at:now,data:result};
 return result;
}
