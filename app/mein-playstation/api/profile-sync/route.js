import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
export const dynamic='force-dynamic';
const URL_ENV='SUPABASE_URL',KEY_ENV='SUPABASE_SECRET_KEY';
const endpoint=()=>{const host=process.env[URL_ENV],secret=process.env[KEY_ENV];if(!host||!secret)return null;try{const parsed=new URL(host);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co'))return null;return {url:parsed.origin+'/rest/v1/psn_private_profile',secret}}catch{return null}};
async function authed(){const jar=await cookies(),expected=sessionToken();return Boolean(expected&&safeEqual(jar.get(COOKIE_NAME)?.value,expected))}
// Opaque sb_secret_* keys are API keys, not JWTs. Legacy service_role JWTs still use Bearer.
const headers=secret=>({apikey:secret,...(secret.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+secret}),'Content-Type':'application/json'});
async function read(config){const response=await fetch(config.url+'?id=eq.default&select=payload,revision,updated_at',{headers:headers(config.secret),cache:'no-store'});if(!response.ok)throw Error('Supabase HTTP '+response.status);const rows=await response.json();return rows[0]||null}
export async function GET(){
 if(!await authed())return Response.json({error:'Nicht angemeldet'},{status:401});
 const config=endpoint();if(!config)return Response.json({configured:false},{headers:{'Cache-Control':'private, no-store'}});
 try{return Response.json({configured:true,record:await read(config)},{headers:{'Cache-Control':'private, no-store'}})}
 catch{return Response.json({error:'Cloud-Daten nicht abrufbar'},{status:503})}
}
export async function PUT(request){
 if(!await authed())return Response.json({error:'Nicht angemeldet'},{status:401});
 const config=endpoint();if(!config)return Response.json({error:'Cloud-Sync nicht konfiguriert'},{status:503});
 const raw=await request.text();if(raw.length>1400000)return Response.json({error:'Daten zu groß'},{status:413});
 let body;try{body=JSON.parse(raw)}catch{return Response.json({error:'Ungültiges JSON'},{status:400})}
 if(!body||!Number.isSafeInteger(body.revision)||body.revision<0||body.version!==2||!body.data||typeof body.data!=='object'||Array.isArray(body.data))return Response.json({error:'Ungültiges Sync-Paket'},{status:400});
 const data=body.data;
 if(!['notes','covers','coverUrls','trophyTargets'].every(k=>data[k]===undefined||data[k]===null||typeof data[k]==='object'&&!Array.isArray(data[k]))||!(data.history===undefined||data.history===null||Array.isArray(data.history)))return Response.json({error:'Ungültige Datenfelder'},{status:400});
 try{
  const current=await read(config),revision=current?.revision??0;
  if(body.revision!==revision)return Response.json({error:'Versionskonflikt',revision,record:current},{status:409});
  const next={id:'default',payload:data,revision:revision+1,updated_at:new Date().toISOString()};
  const opts=current?{method:'PATCH',url:config.url+'?id=eq.default&revision=eq.'+revision,body:{payload:data,revision:revision+1,updated_at:next.updated_at}}:{method:'POST',url:config.url,body:next};
  const response=await fetch(opts.url,{method:opts.method,headers:{...headers(config.secret),Prefer:'return=representation'},body:JSON.stringify(opts.body),cache:'no-store'});
  if(!response.ok)return Response.json({error:'Speichern nicht möglich; gegebenenfalls Versionskonflikt'},{status:response.status===409?409:503});
  const rows=await response.json();if(!rows.length)return Response.json({error:'Versionskonflikt'},{status:409});
  return Response.json({saved:true,revision:rows[0].revision,updated_at:rows[0].updated_at},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Cloud-Speicher derzeit nicht erreichbar'},{status:503})}
}
