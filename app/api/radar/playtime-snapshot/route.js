import {timingSafeEqual} from 'node:crypto';
import {getPsnDashboard} from '../../../../lib/psn-server.mjs';
import {playDurationMinutes} from '../../../../lib/psn-advanced-stats.mjs';
import {cloudHeaders} from '../../../../lib/psn-cloud-helpers.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 const a=Buffer.from(request.headers.get('authorization')||''),b=Buffer.from('Bearer '+secret);
 if(!secret||secret.length<20||a.length!==b.length||!timingSafeEqual(a,b))return Response.json({error:'Unauthorized'},{status:401,headers});
 try{
  const host=new URL(process.env.SUPABASE_URL),key=process.env.SUPABASE_SECRET_KEY;
  if(host.protocol!=='https:'||!host.hostname.endsWith('.supabase.co')||!key)throw Error('Storage unavailable');
  const url=host.origin+'/rest/v1/psn_private_profile?id=eq.default';
  const h=cloudHeaders(key);
  const psn=await getPsnDashboard({force:true});
  const titles=psn.played?.titles;
  if(!psn.connected||psn.played?.paginationComplete!==true||!Array.isArray(titles)||!titles.length)throw Error('Incomplete source');
  const durations=titles.map(t=>playDurationMinutes(t.playDuration));
  if(durations.some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid durations');
  const point={date:new Date().toISOString().slice(0,10),minutes:Math.round(durations.reduce((a,b)=>a+b,0)),games:titles.length};
  for(let attempt=0;attempt<3;attempt++){
   const r=await fetch(url+'&select=payload,revision',{headers:h,cache:'no-store'});
   if(!r.ok)throw Error('Read failed');
   const [current]=await r.json();
   if(!current)throw Error('Missing profile');
   const history=Array.isArray(current.payload?.history)?current.payload.history:[];
   if(history.some(p=>p.date===point.date))return Response.json({ok:true,alreadyRecorded:true},{headers});
   const payload={...current.payload,history:[...history,point].sort((a,b)=>a.date.localeCompare(b.date))};
   const w=await fetch(url+'&revision=eq.'+current.revision,{method:'PATCH',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({payload,revision:current.revision+1,updated_at:new Date().toISOString()}),cache:'no-store'});
   if(!w.ok)throw Error('Write failed');
   if((await w.json()).length)return Response.json({ok:true,saved:true},{headers});
  }
  throw Error('Concurrent update');
 }catch{return Response.json({error:'Snapshot not saved'},{status:503,headers});}
}
