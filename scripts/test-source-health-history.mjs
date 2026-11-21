import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyRows,plannedIncidentEvents,sourceHealthSummary,storeScheduledHealth,markSourceEventRead,readSourceHistory} from '../lib/source-health-history.mjs';

const day='2026-11-21';
const check=(id,state,detail='Teststatus')=>({id,state,detail});
const history=(source_id,run_day,status)=>({source_id,run_day,status,checked_at:run_day+'T09:00:00.000Z'});
test('first bad daily probe does not create an outage notification',()=>{
 assert.deepEqual(plannedIncidentEvents([], [check('psn','error')],day),[]);
 assert.deepEqual(plannedIncidentEvents([history('psn','2026-11-19','error')],[check('psn','error')],day),[],'gaps are unknown, not consecutive');
});
test('second consecutive problem creates exactly one deterministic outage event',()=>{
 const first=[history('psn','2026-11-20','degraded')];
 const events=plannedIncidentEvents(first,[check('psn','error','Provider HTTP 503')],day);
 assert.equal(events.length,1);
 assert.equal(events[0].id,'psn:outage:2026-11-20');
 assert.equal(events[0].event,'outage');
 assert.equal(plannedIncidentEvents([...first,history('psn','2026-11-19','error')],[check('psn','error')],day).length,0,
  'continued outage must not re-alert every day');
});
test('recovery after multiple problem days generates a recovery event; isolated failures do not',()=>{
 const prev=[history('rawg','2026-11-20','degraded'),history('rawg','2026-11-19','error')];
 const list=plannedIncidentEvents(prev,[check('rawg','healthy')],day);
 assert.equal(list.length,1);
 assert.equal(list[0].event,'recovered');
 assert.equal(plannedIncidentEvents(prev.slice(0,1),[check('rawg','healthy')],day).length,0);
 assert.equal(plannedIncidentEvents(prev,[check('rawg','unconfigured')],day).length,0);
});
test('daily payload is bounded, admits known state only and does not include credentials',()=>{
 const checkedAt=day+'T09:00:00.000Z';
 const rows=dailyRows([check('psn','healthy','ok'),check('rawg','error','x'.repeat(400)),check('unknown','healthy')],checkedAt);
 assert.equal(rows.length,2);
 assert.equal(rows[0].run_day,day);
 assert.equal(rows[1].detail.length,250);
 assert.ok(!JSON.stringify(rows).includes('access_token'));
});
test('historical ratio uses recorded days and preserves missing days as unknown',()=>{
 const rows=[history('psn','2026-11-20','healthy'),history('psn','2026-11-19','error'),history('monitor','2026-11-18','unconfigured')];
 const summary=sourceHealthSummary(rows,30,day);
 const psn=summary.find(x=>x.source_id==='psn');
 assert.equal(psn.total,2);
 assert.equal(psn.healthy,1);
 assert.equal(summary.find(x=>x.source_id==='rawg').total,0);
});
test('scheduled recording performs independent historical reads and idempotent conflict-safe inserts',async()=>{
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url,options});
  if(options.method==='PATCH')return new Response('[]',{status:200});
  if(options.method==='POST')return new Response(
   String(url).includes('radar_source_health_checks')?options.body:'[]',{status:201}
  );
  if(String(url).includes('radar_source_health_events'))return new Response('[]',{status:200});
  if(String(url).includes('radar_source_health_transitions'))return new Response('[]',{status:200});
  if(String(url).includes('radar_source_health_checks'))
   return new Response(JSON.stringify([history('psn','2026-11-20','error')]),{status:200});
  throw Error('unexpected');
 };
 const config={base:'https://example.supabase.co/rest/v1/',secret:'sb_secret_hidden'};
 const report={checkedAt:day+'T09:00:00.000Z',checks:[
  check('psn','error'),check('igdb','healthy'),check('rawg','healthy'),
  check('steamgriddb','healthy'),check('profile','healthy'),check('monitor','healthy')
 ]};
 const saved=await storeScheduledHealth(config,report,{fetcher});
 assert.deepEqual(saved,{recorded:6,inserted:6,updated:0,incidentCandidates:1,day});
 const writes=calls.filter(c=>c.options.method==='POST');
 assert.equal(writes.length,2);
 assert.ok(writes.every(x=>x.options.headers.Prefer.includes('ignore-duplicates')));
 assert.equal(JSON.parse(writes[0].options.body).length,6);
 assert.equal(JSON.parse(writes[1].options.body)[0].id,'psn:outage:2026-11-20');
 assert.ok(writes.every(x=>!x.options.body.includes('sb_secret_hidden')),'secret must not appear in persisted payloads');
});
test('acknowledgements reject unsafe IDs and write only the requested inbox row',async()=>{
 let captured;
 const config={base:'https://example.supabase.co/rest/v1/',secret:'x'};
 const fetcher=async(url,opts)=>{captured={url,opts};return new Response(JSON.stringify([{id:'rawg:outage:2026-11-20'}]),{status:200})};
 await assert.rejects(()=>markSourceEventRead(config,'id=eq.*,read_at', {fetcher}),/Invalid incident ID/);
 await markSourceEventRead(config,'rawg:outage:2026-11-20',{fetcher,now:new Date(day+'T10:00:00.000Z')});
 assert.equal(captured.opts.method,'PATCH');
 assert.ok(captured.url.includes('id=eq.rawg%3Aoutage%3A2026-11-20'));
 assert.ok(captured.url.includes('read_at=is.null'));
});

test('manual rerun on the same UTC day does not manufacture a second daily incident',async()=>{
 const writeTables=[];
 const fetcher=async(url,options={})=>{
  const name=String(url);
  if(options.method==='PATCH')return new Response('[]',{status:200});
  if(options.method==='POST'){
   writeTables.push(name);
   return new Response('[]',{status:201}); // Unique-key conflict, zero newly inserted daily rows.
  }
  if(name.includes('radar_source_health_events'))return new Response('[]',{status:200});
  if(name.includes('radar_source_health_transitions'))return new Response('[]',{status:200});
  if(name.includes('radar_source_health_checks'))return new Response(JSON.stringify([history('psn','2026-11-20','error')]),{status:200});
  throw Error('Unexpected data request');
 };
 const config={base:'https://example.supabase.co/rest/v1/',secret:'server_only'};
 const report={checkedAt:day+'T09:00:00.000Z',checks:[
  check('psn','error'),check('igdb','healthy'),check('rawg','healthy'),
  check('steamgriddb','healthy'),check('profile','healthy'),check('monitor','healthy')
 ]};
 const result=await storeScheduledHealth(config,report,{fetcher});
 assert.deepEqual(result,{recorded:6,inserted:0,updated:0,incidentCandidates:0,day});
 assert.equal(writeTables.length,1,'An existing day must not produce another incident write');
});

test('latest source probes are conditionally updated without rewriting the first day reading',async()=>{
 const updates=[];
 const initial={
  source_id:'igdb',run_day:'2026-11-21',checked_at:'2026-11-21T03:34:00.999Z',
  status:'error',detail:'OAuth 403',latest_status:'error',latest_checked_at:'2026-11-21T03:34:00.999Z'
 };
 const fetcher=async(url,options={})=>{
  const path=String(url);
  if(options.method==='POST')return new Response('[]',{status:201});
  if(options.method==='PATCH'){
   updates.push({url:path,body:JSON.parse(options.body)});
   return new Response(path.includes('source_id=eq.igdb')?JSON.stringify([initial]):'[]',{status:200});
  }
  if(path.includes('radar_source_health_transitions'))return new Response('[]',{status:200});
  if(path.includes('radar_source_health_events'))return new Response('[]',{status:200});
  if(path.includes('radar_source_health_checks'))return new Response(JSON.stringify([initial]),{status:200});
  throw Error('Unexpected storage read');
 };
 const report={checkedAt:'2026-11-21T03:56:00.000Z',checks:[
  check('psn','healthy'),check('igdb','healthy','Twitch OAuth OK'),
  check('rawg','healthy'),check('steamgriddb','healthy'),
  check('profile','healthy'),check('monitor','healthy')
 ]};
 const result=await storeScheduledHealth({base:'https://example.supabase.co/rest/v1/',secret:'server_only'},report,{fetcher});
 assert.deepEqual(result,{recorded:6,inserted:0,updated:1,incidentCandidates:0,day:'2026-11-21'});
 assert.equal(updates.length,6);
 const igdb=updates.find(x=>x.url.includes('source_id=eq.igdb'));
 assert.equal(igdb.body.latest_status,'healthy');
 assert.equal(igdb.body.latest_checked_at,report.checkedAt);
 assert.equal(Object.keys(igdb.body).some(key=>['status','checked_at','detail'].includes(key)),false,
  'First-day columns must never be updated');
 assert.ok(igdb.url.includes('latest_checked_at.lt.'),'Stale or concurrent observations must not overwrite newer results');
 assert.ok(igdb.url.includes('run_day=eq.2026-11-21'));
});

test('private history API reads immutable first, latest saved statuses and independent transitions',async()=>{
 const calls=[];
 const config={base:'https://example.supabase.co/rest/v1/',secret:'server'};
 const fetcher=async url=>{
  calls.push(String(url));
  if(String(url).includes('radar_source_health_checks'))return new Response(JSON.stringify([
   {source_id:'igdb',run_day:'2026-11-21',status:'error',checked_at:'2026-11-21T03:34:00Z',
    latest_status:'healthy',latest_checked_at:'2026-11-21T03:56:00Z'}
  ]),{status:200});
  if(String(url).includes('radar_source_health_transitions'))return new Response(JSON.stringify([
   {id:1,source_id:'igdb',previous_status:'error',status:'healthy',checked_at:'2026-11-21T03:56:00Z'}
  ]),{status:200});
  return new Response('[]',{status:200});
 };
 const data=await readSourceHistory(config,{fetcher});
 assert.equal(data.checks[0].status,'error');
 assert.equal(data.checks[0].latest_status,'healthy');
 assert.equal(data.transitions[0].previous_status,'error');
 assert.equal(data.transitions[0].status,'healthy');
 assert.equal(calls.length,3);
 assert.ok(calls.some(x=>x.includes('latest_checked_at')));
 assert.ok(calls.some(x=>x.includes('radar_source_health_transitions')));
});
