import test from 'node:test';
import assert from 'node:assert/strict';
import {MANUAL_SCAN_COOLDOWN_MS,reserveManualSourceScan,runLiveSourceScan} from '../lib/source-live-ops.mjs';

const storage={base:'https://example.supabase.co/rest/v1/',secret:'never-in-client'};
const now=new Date('2026-11-21T11:30:00.000Z');
const sample={
 checkedAt:now.toISOString(),checks:[
  {id:'psn',state:'healthy',detail:'PSN erreichbar'},
  {id:'igdb',state:'healthy',detail:'IGDB erreichbar'},
  {id:'rawg',state:'error',detail:'HTTP 500'},
  {id:'steamgriddb',state:'healthy',detail:'SteamGridDB erreichbar'},
  {id:'profile',state:'healthy',detail:'Profile OK'},
  {id:'monitor',state:'degraded',detail:'Upload stale'}
 ],summary:{healthy:4,degraded:1,error:1,unconfigured:0},cacheSeconds:60
};
test('manual checks are limited by a cross-instance conditional database update',async()=>{
 let times=0;
 const seen=[];
 const db=async(conf,table,query,opts)=>{
  times++;seen.push({conf,table,query,opts});
  return times===1?[{id:'default'}]:[];
 };
 assert.equal(await reserveManualSourceScan(storage,{now,db}),true);
 assert.equal(await reserveManualSourceScan(storage,{now,db}),false);
 assert.equal(MANUAL_SCAN_COOLDOWN_MS,600000);
 assert.equal(seen[0].table,'pushControl');
 assert.equal(seen[0].opts.method,'PATCH');
 assert.equal(seen[0].opts.prefer,'return=representation');
 assert.match(seen[0].query,/last_manual_scan_at=lt/);
 assert.equal(seen[0].opts.data.last_manual_scan_at,now.toISOString());
 assert.ok(!seen[0].query.includes('never-in-client'));
});
test('manual check fails closed if cooldown storage cannot be verified',async()=>{
 await assert.rejects(()=>reserveManualSourceScan(null,{now}),/storage/i);
 await assert.rejects(()=>reserveManualSourceScan(storage,{now:new Date('invalid')}),/storage\/time/);
 await assert.rejects(()=>reserveManualSourceScan(storage,{now,db:async()=>{throw Error('DB offline')}}),/DB offline/);
});
test('live source run bypasses stale provider cache, persists daily result and attempts push',async()=>{
 const calls=[];
 const result=await runLiveSourceScan(storage,{
  now:now.getTime(),
  check:async options=>{calls.push(['inspect',options]);return sample},
  save:async(conf,report)=>{calls.push(['save',conf,report]);return {recorded:6,inserted:6,incidentCandidates:1,day:'2026-11-21'}},
  dispatch:async(conf,channel,options)=>{calls.push(['push',conf,channel,options]);return {configured:true,attempted:1,accepted:1,failed:0}},
  pushConfig:()=>({topic:'private_test_topic'})
 });
 assert.equal(result.ok,true);
 assert.deepEqual(result.summary,sample.summary);
 assert.equal(result.stored.inserted,6);
 assert.equal(result.push.accepted,1);
 assert.equal(result.cacheSeconds,0);
 assert.deepEqual(calls[0],['inspect',{useCache:false,now:now.getTime()}]);
 assert.equal(calls[1][0],'save');
 assert.equal(calls[2][0],'push');
 assert.equal(calls[2][3].limit,5);
});
test('push failure must not erase a successful live source record',async()=>{
 const a=await runLiveSourceScan(storage,{
  check:async()=>sample,
  save:async()=>({recorded:6,inserted:0,incidentCandidates:0,day:'2026-11-21'}),
  dispatch:async()=>{throw Error('Do not send this raw error to frontend')},
  pushConfig:()=>({topic:'private_test_topic'})
 });
 assert.equal(a.ok,true);
 assert.equal(a.push.deliveryError,true);
 assert.ok(!JSON.stringify(a).includes('raw error'));
});
test('invalid provider report does not write or send notifications',async()=>{
 let saved=false;
 await assert.rejects(()=>runLiveSourceScan(storage,{
  check:async()=>({...sample,checks:[]}),
  save:async()=>{saved=true},
  dispatch:async()=>{throw Error('Unexpected push')}
 }),/Unexpected live health report/);
 assert.equal(saved,false);
});
