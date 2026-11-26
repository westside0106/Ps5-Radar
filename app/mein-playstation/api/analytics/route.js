import {cookies} from 'next/headers';
import {COOKIE_NAME,safeEqual,sessionToken} from '../../../auth';
import {getPsnDashboard,getPsnDigitalLibrary} from '../../../../lib/psn-server.mjs';
import {GET as getProfile} from '../profile-sync/route';
import {GET as getMonitor} from '../monitor-sync/route';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 const jar=await cookies(),expected=sessionToken();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))return Response.json({error:'Nicht angemeldet'},{status:401,headers});
 const [psn,library,profile,monitor]=await Promise.allSettled([getPsnDashboard(),getPsnDigitalLibrary(),getProfile().then(async r=>{if(!r.ok)throw Error('Cloud unavailable');return r.json()}),getMonitor().then(async r=>{if(!r.ok)throw Error('Monitor unavailable');return r.json()})]);
 const sources={};
 for(const [name,result] of Object.entries({psn,library,profile,monitor})){
  sources[name]=result.status==='fulfilled'?{available:true,data:result.value}:{available:false,data:null};
 }
 if(sources.psn.data?.connected!==true)sources.psn.available=false;
 if(!sources.profile.data?.record)sources.profile.available=false;
 if(sources.monitor.data?.connected!==true)sources.monitor.available=false;
 return Response.json({version:1,generatedAt:new Date().toISOString(),sources},{headers});
}
