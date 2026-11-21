import test from 'node:test';
import assert from 'node:assert/strict';
import {auditedSourceRun,readSourceScanRuns} from '../lib/source-scan-audit.mjs';

const storage={base:'https://example.supabase.co/rest/v1/',secret:'private_service_role'};
const id='11111111-2222-4333-8444-555555555555';
const base=Date.parse('2026-11-21T09:00:00Z');
const clock=()=>new Date(base);
const okReport={
 ok:true,checkedAt:'2026-11-21T09:00:00.000Z',
 summary:{healthy:5,degraded:1,error:0,unconfigured:0},
 stored:{recorded:6,inserted:0,updated:6},
 push:{accepted:1,failed:0},
 checks:[{id:'igdb',detail:'PRIVATE PSN ACCOUNT DATA'}]
};

test('scheduled execution records a start and completed receipt, never sensitive provider detail',async()=>{
 const calls=[];let time=0;
 const db=async(config,table,query,options={})=>{
  calls.push({config,table,query,options});
  if(options.method==='POST')return [];
  if(options.method==='PATCH')return [{id}];
  throw Error('Unexpected method');
 };
 const result=await auditedSourceRun(storage,'scheduled',async()=>okReport,{
  db,makeId:()=>id,clock:()=>new Date(base+time++*2500)
 });
 assert.equal(result.audit.recorded,true);
 assert.equal(calls.length,2);
 assert.equal(calls[0].table,'runs');
 assert.equal(calls[0].options.data.run_kind,'scheduled');
 assert.equal(calls[0].options.data.result,'running');
 assert.equal(calls[1].options.data.result,'success');
 assert.equal(calls[1].options.data.duration_ms,2500);
 assert.equal(calls[1].options.data.healthy_count,5);
 assert.equal(calls[1].options.data.degraded_count,1);
 assert.equal(calls[1].options.data.daily_inserted,0);
 assert.equal(calls[1].options.data.latest_updated,6);
 assert.equal(calls[1].options.data.push_accepted,1);
 assert.equal(calls[1].options.data.push_failed,0);
 for(const call of calls){
  const value=JSON.stringify(call.options.data||{});
  assert.ok(!value.includes('PRIVATE PSN ACCOUNT DATA'));
  assert.ok(!value.includes('private_service_role'));
 }
});
test('failed actual scan still writes a failed receipt but returns the original error',async()=>{
 const requests=[];
 const db=async(config,table,query,options={})=>{
  requests.push(options);
  return options.method==='PATCH'?[{id}]:[];
 };
 await assert.rejects(
  auditedSourceRun(storage,'manual',async()=>{throw Error('provider secret: never persist')},{
   db,clock,makeId:()=>id
  }),/provider secret/);
 assert.equal(requests.length,2);
 assert.equal(requests[1].data.result,'failed');
 assert.equal(requests[1].data.failure_code,'scan_failed');
 assert.equal(requests[1].data.healthy_count,undefined);
 assert.ok(!JSON.stringify(requests).includes('provider secret'));
});
test('audit storage outage cannot block a successful provider check',async()=>{
 let runs=0,calls=0;
 const report=await auditedSourceRun(storage,'manual',async()=>{runs++;return okReport},{
  db:async()=>{calls++;throw Error('Storage leak secret')},
  makeId:()=>id,clock
 });
 assert.equal(runs,1);
 assert.equal(calls,1);
 assert.equal(report.audit.recorded,false);
 assert.ok(!JSON.stringify(report).includes('Storage leak secret'));
});
test('a lost completion acknowledgement is not reported as a successful audit',async()=>{
 let calls=0;
 const result=await auditedSourceRun(storage,'scheduled',async()=>okReport,{
  db:async(config,table,query,opts)=>{calls++;return opts.method==='PATCH'?[]:[]},
  clock,makeId:()=>id
 });
 assert.equal(result.audit.recorded,false);
 assert.equal(calls,2);
});
test('invalid mode or identity fails before running providers or hitting storage',async()=>{
 let count=0;
 const execute=async()=>{count++;return okReport};
 await assert.rejects(()=>auditedSourceRun(storage,'unknown',execute,{makeId:()=>id,clock}),/Invalid/);
 await assert.rejects(()=>auditedSourceRun(storage,'manual',execute,{makeId:()=>'invalid',clock}),/identity/);
 assert.equal(count,0);
});
test('private audit history reads a bounded, newest-first list',async()=>{
 const logs=[];
 const rows=await readSourceScanRuns(storage,{
  limit:500,db:async(config,table,query)=>{logs.push({config,table,query});return [{id,run_kind:'scheduled',result:'success'}]}
 });
 assert.equal(rows.length,1);
 assert.equal(logs[0].table,'runs');
 assert.match(logs[0].query,/order=started_at.desc&limit=120/);
 assert.ok(!logs[0].query.includes(storage.secret));
 await assert.rejects(()=>readSourceScanRuns(storage,{db:async()=>({})}),/Invalid source scan audit response/);
});
