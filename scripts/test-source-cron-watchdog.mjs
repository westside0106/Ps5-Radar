import test from 'node:test';
import assert from 'node:assert/strict';
import {
 watchdogConclusion,watchdogPushMessage,inspectScheduledSourceRun,
 runSourceCronWatchdog,deliverWatchdogNtfy,readWatchdogHistory
} from '../lib/source-cron-watchdog.mjs';

const storage={base:'https://example.supabase.co/rest/v1/',secret:'server-only-do-not-export'};
const at=new Date('2026-11-21T11:25:00.000Z');
const earlier=new Date('2026-11-21T09:03:00.000Z').toISOString();
const run=(result,started_at=earlier)=>({run_kind:'scheduled',result,started_at});

test('watchdog prioritizes actual completed scheduled receipts over failed attempts',()=>{
 assert.deepEqual(watchdogConclusion([run('failed'),run('success')],6,{now:at}),
  {status:'ok',scheduledRuns:2,dailySources:6});
 assert.equal(watchdogConclusion([run('failed')],0,{now:at}).status,'failed');
 assert.equal(watchdogConclusion([run('running')],0,{now:at}).status,'unfinished');
 assert.equal(watchdogConclusion([],6,{now:at}).status,'unconfirmed');
 assert.equal(watchdogConclusion([],3,{now:at}).status,'missing');
 const now=new Date('2026-11-21T09:04:00.000Z');
 assert.equal(watchdogConclusion([run('running')],0,{now}).status,'pending');
 assert.equal(watchdogConclusion([run('success','2026-11-20T09:00:00.000Z')],0,{now:at}).status,'missing',
  'Yesterday must not count as today');
});
test('watchdog checks a strict UTC-day window and counts distinct persisted sources',async()=>{
 const calls=[];
 const db=async(config,table,query)=>{
  calls.push({table,query});
  return table==='runs'?[run('failed')]:
   [{source_id:'psn'},{source_id:'igdb'},{source_id:'psn'}];
 };
 const result=await inspectScheduledSourceRun(storage,{db,now:at});
 assert.deepEqual(result,{day:'2026-11-21',status:'failed',scheduledRuns:1,dailySources:2});
 assert.equal(calls[0].table,'runs');
 assert.match(calls[0].query,/run_kind=eq.scheduled/);
 assert.match(calls[0].query,/started_at=gte/);
 assert.match(calls[0].query,/started_at=lt/);
 assert.equal(calls[1].table,'checks');
 assert.match(calls[1].query,/run_day=eq.2026-11-21/);
});
test('before the late Cron evaluation window the watchdog writes and sends nothing',async()=>{
 let calls=0;
 const result=await runSourceCronWatchdog(storage,{
  now:new Date('2026-11-21T10:59:59Z'),db:async()=>{calls++;throw Error('Unexpected read')}
 });
 assert.equal(result.status,'not_due');
 assert.equal(result.stored,false);
 assert.equal(calls,0);
});
test('successful scheduled source checks create no watchdog warning',async()=>{
 const calls=[];
 const db=async(config,table,query,opts={})=>{
  calls.push({table,query,opts});
  if(table==='runs')return [run('success')];
  if(table==='checks')return ['psn','igdb','rawg','steamgriddb','profile','monitor'].map(source_id=>({source_id}));
  if(opts.method==='POST')return [{run_day:'2026-11-21',status:'ok'}];
  if(table==='watchdog')return [];
  throw Error('Unexpected storage read');
 };
 const send=async()=>{throw Error('Unexpected ntfy warning for healthy Cron')};
 const result=await runSourceCronWatchdog(storage,{now:at,db,ntfy:{origin:'https://ntfy.sh',topic:'internal_topic'},send});
 assert.equal(result.status,'ok');
 assert.equal(result.stored,true);
 assert.equal(result.newRecord,true);
 assert.equal(result.push.accepted,0);
 assert.ok(!calls.some(c=>c.opts.method==='PATCH'));
});
test('missing Cron is stored once and a generic warning receives a leased, idempotent ntfy acknowledgement',async()=>{
 let record=null,sendCount=0;
 const calls=[];
 const db=async(config,table,query,opts={})=>{
  calls.push({table,query,opts});
  if(table==='runs'||table==='checks')return [];
  if(table!=='watchdog')throw Error('Unexpected table');
  if(opts.method==='POST'){
   if(record)return [];
   record={...opts.data,push_sent_at:null,push_attempts:0,push_lease_until:null};
   return [record];
  }
  if(opts.method==='PATCH'){
   if(query.includes('push_sent_at=is.null')&&record.push_sent_at)return [];
   Object.assign(record,opts.data);
   return [record];
  }
  if(query.includes('status=neq.ok'))return record?.push_sent_at?[]:[record];
  return record?[record]:[];
 };
 const send=async(config,message)=>{
  sendCount++;
  assert.equal(message.priority,'3');
  assert.ok(!JSON.stringify(message).includes(storage.secret));
  assert.ok(!JSON.stringify(message).includes('Twitch'));
  assert.match(message.title,/Tagescheck/);
  assert.match(message.body,/kein automatischer Quellencheck protokolliert/);
 };
 const cfg={origin:'https://ntfy.sh',topic:'some_very_long_private_test_topic'};
 const first=await runSourceCronWatchdog(storage,{now:at,db,ntfy:cfg,send});
 assert.equal(first.status,'missing');
 assert.equal(first.push.accepted,1);
 assert.equal(first.newRecord,true);
 const second=await runSourceCronWatchdog(storage,{now:at,db,ntfy:cfg,send});
 assert.equal(second.status,'missing');
 assert.equal(second.newRecord,false);
 assert.equal(second.push.accepted,0);
 assert.equal(sendCount,1);
 assert.ok(record.push_sent_at);
 assert.ok(calls.some(x=>x.opts?.data?.push_lease_token));
});
test('failed ntfy acknowledgement is not claimed successful and remains for a future retry',async()=>{
 const row={run_day:'2026-11-21',status:'failed',push_sent_at:null,push_attempts:0};
 const writes=[];
 const db=async(_config,table,_q,opts={})=>{
  if(opts.method==='PATCH'){writes.push(opts.data);return [row]}
  return [row];
 };
 const r=await deliverWatchdogNtfy(storage,{topic:'private'},{
  db,now:at,send:async()=>{throw Error('Bearer secret must never persist')}
 });
 assert.deepEqual({attempted:r.attempted,accepted:r.accepted,failed:r.failed},{attempted:1,accepted:0,failed:1});
 assert.equal(writes.at(-1).push_last_error,'transport_or_ack_failed');
 assert.ok(!JSON.stringify(writes).includes('Bearer secret'));
});
test('missing ntfy configuration leaves problems visible without fake delivery',async()=>{
 const result=await deliverWatchdogNtfy(storage,null,{db:async()=>{throw Error('Unexpected storage')}});
 assert.deepEqual(result,{configured:false,attempted:0,accepted:0,failed:0});
});
test('watchdog does not pretend to know the state if either audit or day storage is inaccessible',async()=>{
 await assert.rejects(()=>runSourceCronWatchdog(storage,{
  now:at,db:async()=>{throw Error('DB offline')}
 }),/DB offline/);
});
test('stored history is bounded, newest-first and contains no private provider detail',async()=>{
 let tableName,query;
 const records=await readWatchdogHistory(storage,{
  limit:500,db:async(_storage,table,path)=>{tableName=table;query=path;return [{run_day:'2026-11-21',status:'ok'}]}
 });
 assert.equal(records.length,1);
 assert.equal(tableName,'watchdog');
 assert.match(query,/order=run_day.desc&limit=60/);
 assert.ok(!query.includes('secret'));
 assert.throws(()=>watchdogPushMessage({run_day:'2026-11-21',status:'ok'}),/Invalid/);
 assert.throws(()=>watchdogPushMessage({run_day:'2026-11-21',status:'secret-leak'}),/Invalid/);
});
