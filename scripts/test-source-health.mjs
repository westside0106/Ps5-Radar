import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSourceHealth,healthSummary} from '../lib/source-health.mjs';

const clock=Date.parse('2026-11-21T03:00:00.000Z');
const configured={
 PSN_NPSSO:'a'.repeat(32),
 IGDB_CLIENT_ID:'private-igdb-id',
 IGDB_CLIENT_SECRET:'private-igdb-secret',
 RAWG_API_KEY:'private-rawg-key',
 STEAMGRIDDB_API_KEY:'private-grid-key',
 SUPABASE_URL:'https://sample.supabase.co/',
 SUPABASE_SECRET_KEY:'sb_secret_private'
};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const okFetcher=async (url,opts={})=>{
 const path=String(url);
 if(path.includes('id.twitch.tv'))return json({access_token:'private-access-token'});
 if(path.includes('api.igdb.com'))return json([{id:1}]);
 if(path.includes('api.rawg.io'))return json({results:[]});
 if(path.includes('steamgriddb.com'))return json({data:[]});
 if(path.includes('psn_private_profile'))return json([{id:'default'}]);
 if(path.includes('psn_monitor_snapshot'))return json([{received_at:new Date(clock-10*60000).toISOString()}]);
 throw Error('Unexpected URL '+path.replace(/key=[^&]+/,'key=REDACTED'));
};
const psnReader=async()=>({connected:true,checkedAt:new Date(clock).toISOString(),errors:[]});

test('empty environment does not probe external sources or infer success',async()=>{
 const data=await checkSourceHealth({env:{},fetcher:()=>{throw Error('must not fetch')},psnReader:()=>{throw Error('must not query PSN')},now:clock,useCache:false});
 assert.equal(data.checks.length,6);
 assert.equal(data.summary.unconfigured,6);
 assert.equal(data.summary.healthy,0);
 assert.equal(data.backgroundMonitoring,false);
});
test('successful requests are distinct from monitor freshness and redact every secret',async()=>{
 const data=await checkSourceHealth({env:configured,fetcher:okFetcher,psnReader,now:clock,useCache:false});
 assert.equal(data.summary.healthy,6);
 assert.equal(data.checks.find(x=>x.id==='monitor').ageMinutes,10);
 const serialized=JSON.stringify(data);
 for(const key of ['private-igdb-id','private-igdb-secret','private-rawg-key','private-grid-key','sb_secret_private','private-access-token','a'.repeat(32)])assert.equal(serialized.includes(key),false);
});
test('stale uploads and partial PSN data are reported degraded, not as healthy',async()=>{
 const data=await checkSourceHealth({
  env:configured,now:clock,useCache:false,
  psnReader:async()=>({connected:true,errors:['played failed'],checkedAt:new Date(clock).toISOString()}),
  fetcher:async(url,options)=>{
   if(String(url).includes('psn_monitor_snapshot'))return json([{received_at:new Date(clock-95*60000).toISOString()}]);
   return okFetcher(url,options);
  }
 });
 assert.equal(data.checks.find(x=>x.id==='psn').state,'degraded');
 assert.equal(data.checks.find(x=>x.id==='monitor').state,'degraded');
 assert.equal(data.checks.find(x=>x.id==='monitor').ageMinutes,95);
 assert.equal(data.summary.degraded,2);
});
test('API limits are not declared outages and 401 is not declared available',async()=>{
 const data=await checkSourceHealth({
  env:configured,now:clock,useCache:false,psnReader,
  fetcher:async(url,opts)=>{
   if(String(url).includes('api.rawg.io'))return json({error:'limit'},429);
   if(String(url).includes('steamgriddb.com'))return json({error:'invalid'},401);
   return okFetcher(url,opts);
  }
 });
 assert.equal(data.checks.find(x=>x.id==='rawg').state,'degraded');
 assert.equal(data.checks.find(x=>x.id==='steamgriddb').state,'error');
 assert.deepEqual(healthSummary(data.checks),{healthy:4,degraded:1,error:1,unconfigured:0});
});
test('missing cloud table and malformed timestamp are not valid monitor observations',async()=>{
 const data=await checkSourceHealth({
  env:configured,now:clock,useCache:false,psnReader,
  fetcher:async(url,opts)=>String(url).includes('psn_monitor_snapshot')?json([{received_at:'invalid'}]):okFetcher(url,opts)
 });
 assert.equal(data.checks.find(x=>x.id==='monitor').state,'degraded');
 assert.equal(data.checks.find(x=>x.id==='monitor').lastDataAt,undefined);
});

test('IGDB errors distinguish Twitch OAuth rejection from IGDB API rejection without exposing secrets',async()=>{
 const oauth=await checkSourceHealth({env:configured,now:clock,useCache:false,psnReader,
  fetcher:async(url,opts)=>String(url).includes('id.twitch.tv')?json({message:'private-igdb-secret'},401):okFetcher(url,opts)});
 const a=oauth.checks.find(x=>x.id==='igdb');
 assert.equal(a.state,'error');assert.equal(a.phase,'oauth');assert.equal(a.httpStatus,401);
 assert.match(a.detail,/Twitch-OAuth/);
 assert.match(a.nextStep,/IGDB_CLIENT_SECRET/);
 const api=await checkSourceHealth({env:configured,now:clock,useCache:false,psnReader,
  fetcher:async(url,opts)=>String(url).includes('api.igdb.com')?json({message:'private-access-token'},401):okFetcher(url,opts)});
 const b=api.checks.find(x=>x.id==='igdb');
 assert.equal(b.state,'error');assert.equal(b.phase,'api');assert.equal(b.httpStatus,401);
 assert.match(b.detail,/IGDB-Datenabfrage/);
 for(const value of ['private-igdb-id','private-igdb-secret','private-access-token']) {
  assert.equal(JSON.stringify({a,b}).includes(value),false);
 }
});
test('IGDB error classification distinguishes rate limits and network failures',async()=>{
 const limited=await checkSourceHealth({env:configured,now:clock,useCache:false,psnReader,
  fetcher:async(url,opts)=>String(url).includes('id.twitch.tv')?json({},429):okFetcher(url,opts)});
 assert.equal(limited.checks.find(x=>x.id==='igdb').state,'degraded');
 assert.equal(limited.checks.find(x=>x.id==='igdb').phase,'oauth');
 const network=await checkSourceHealth({env:configured,now:clock,useCache:false,psnReader,
  fetcher:async(url,opts)=>String(url).includes('api.igdb.com')?Promise.reject(new Error('private client token unexpected')):okFetcher(url,opts)});
 const result=network.checks.find(x=>x.id==='igdb');
 assert.equal(result.state,'error');assert.equal(result.phase,'api');
 assert.equal(JSON.stringify(result).includes('private client token unexpected'),false);
});
