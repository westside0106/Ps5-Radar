import test from 'node:test';
import assert from 'node:assert/strict';
import {monitorStorageConfig,readMonitorSnapshot,saveMonitorSnapshot} from '../lib/psn-monitor-cloud-server.mjs';
import {normalizeObservedSessions} from '../lib/psn-monitor-import.mjs';

const env={SUPABASE_URL:'https://qayryxbbgegeidzkqrxt.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_unit-test'};
const config=monitorStorageConfig(env);
const session={game:'Cyberpunk 2077',start:'2026-11-20T10:00:00.000Z',end:'2026-11-20T11:00:00.000Z',timeZone:'UTC',minutes:999999,source:'unsafe'};
const session2={game:'Hitman World of Assassination',start:'2026-11-20T12:00:00.000Z',end:'2026-11-20T12:30:00.000Z',timeZone:'UTC'};
const parsed={sessions:[session],rows:3,timeZone:'UTC',warningCounts:{incomplete:1}};

function fakeStore({initial=null,onFirstPatch=()=>{}}={}){
 let data=initial;
 let writes=0,reads=0,patches=0;
 const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
 const fetcher=async (url,options={})=>{
  assert.ok(url.startsWith(config.url),'must never send data to non-monitor storage');
  assert.equal(options.headers.apikey,env.SUPABASE_SECRET_KEY);
  assert.equal(options.headers.Authorization,undefined,'opaque secret must not be exposed via Authorization');
  const method=options.method||'GET';
  if(method==='GET'){reads++;return response(200,data?[structuredClone(data)]:[])}
  writes++;
  const item=JSON.parse(options.body);
  if(method==='POST'){
   if(data)return response(409,{error:'duplicate'});
   data={...item};return response(201,[structuredClone(data)]);
  }
  assert.equal(method,'PATCH');
  patches++;if(patches===1)onFirstPatch({current:data,setData:row=>{data=row}});
  const revision=new URL(url).searchParams.get('revision').slice(3);
  if(!data||Number(revision)!==data.revision)return response(200,[]);
  data={...data,...item};return response(200,[structuredClone(data)]);
 };
 return {fetcher,getData:()=>data,get writes(){return writes},get reads(){return reads}};
}
test('storage config accepts only secure Supabase hosts and server-only credentials',()=>{
 assert.equal(config.url,'https://qayryxbbgegeidzkqrxt.supabase.co/rest/v1/psn_monitor_snapshot');
 assert.equal(monitorStorageConfig({SUPABASE_URL:'https://qayryxbbgegeidzkqrxt.supabase.co.attacker.test',SUPABASE_SECRET_KEY:'x'}),null);
 assert.equal(monitorStorageConfig({SUPABASE_URL:'http://qayryxbbgegeidzkqrxt.supabase.co',SUPABASE_SECRET_KEY:'x'}),null);
 assert.equal(monitorStorageConfig({SUPABASE_URL:'https://u:p@qayryxbbgegeidzkqrxt.supabase.co',SUPABASE_SECRET_KEY:'x'}),null);
 assert.equal(monitorStorageConfig({SUPABASE_URL:'https://qayryxbbgegeidzkqrxt.supabase.co',SUPABASE_SECRET_KEY:''}),null);
});
test('create new snapshot, sanitizes imported durations, and never touches profile storage',async()=>{
 const store=fakeStore();
 const result=await saveMonitorSnapshot(config,parsed,{fetcher:store.fetcher,now:new Date('2026-11-22T02:00:00Z')});
 assert.equal(result.added,1);assert.equal(result.total,1);assert.equal(result.revision,1);
 const row=store.getData();
 assert.equal(row.id,'default');assert.equal(row.sessions.length,1);
 assert.equal(row.sessions[0].minutes,60);
 assert.equal(row.sessions[0].source,'psn_monitor CSV');
 assert.equal(row.time_zone,'UTC');
 assert.equal(row.row_count,3);
 const read=await readMonitorSnapshot(config,{fetcher:store.fetcher});
 assert.equal(read.sessions.length,1);
 assert.equal(read.warningCounts.incomplete,1);
});
test('repeat uploads are idempotent, no duplicated intervals or user-profile writes',async()=>{
 const store=fakeStore();
 const a=await saveMonitorSnapshot(config,parsed,{fetcher:store.fetcher});
 const b=await saveMonitorSnapshot(config,parsed,{fetcher:store.fetcher});
 assert.equal(a.added,1);assert.equal(b.added,0);
 assert.equal(b.total,1);
 assert.equal(b.revision,2);
 assert.equal(store.getData().sessions.length,1);
});
test('optimistic conflict retries after parallel write and preserves both sets of sessions',async()=>{
 const existing=normalizeObservedSessions([session])[0];
 const initial={id:'default',sessions:[existing],revision:1,received_at:'2026-11-20T11:00:00Z',time_zone:'UTC',row_count:3,warning_counts:{}};
 const store=fakeStore({initial,onFirstPatch:({current,setData})=>setData({...current,revision:2})});
 const result=await saveMonitorSnapshot(config,{...parsed,sessions:[session2]}, {fetcher:store.fetcher});
 assert.equal(result.revision,3);
 assert.equal(result.added,1);
 assert.equal(store.getData().sessions.length,2);
 assert.equal(store.getData().revision,3);
 assert.ok(store.reads>=2);
});
test('read-only server GET handles empty snapshots without fabricating sessions',async()=>{
 const store=fakeStore();
 assert.equal(await readMonitorSnapshot(config,{fetcher:store.fetcher}),null);
 assert.equal(store.writes,0);
});
test('storage failures and always-losing optimistic writes cannot be reported as successful',async()=>{
 const existing=normalizeObservedSessions([session])[0];
 const initial={id:'default',sessions:[existing],revision:1,received_at:'2026-11-20T11:00:00Z',time_zone:'UTC',row_count:3,warning_counts:{}};
 const failing=async (url,options={})=>{
  if((options.method||'GET')==='GET')return {ok:true,status:200,json:async()=>[initial]};
  return {ok:true,status:200,json:async()=>[]};
 };
 await assert.rejects(()=>saveMonitorSnapshot(config,parsed,{fetcher:failing}),error=>error.status===409);
});
test('zero valid sessions may signal a completed monitor heartbeat without inventing gameplay',async()=>{
 const store=fakeStore();
 const heartbeat=await saveMonitorSnapshot(config,{sessions:[],rows:2,timeZone:'Europe/Berlin',warningCounts:{incomplete:1}},{fetcher:store.fetcher});
 assert.equal(heartbeat.added,0);
 assert.equal(heartbeat.total,0);
 assert.equal(store.getData().sessions.length,0);
 assert.equal(store.getData().time_zone,'Europe/Berlin');
});
