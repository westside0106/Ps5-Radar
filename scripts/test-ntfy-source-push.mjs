import test from 'node:test';
import assert from 'node:assert/strict';
import {ntfyConfig,ntfyEventMessage,ntfyTestMessage,publishNtfy,deliverPendingNtfy,reservePushTest} from '../lib/ntfy-source-push.mjs';

const topic='ps5-radar-02468abcdef98765abcd';
const config={origin:'https://ntfy.sh',topic,authToken:null};
const storage={base:'https://private.supabase.co/rest/v1/',secret:'sb_secret_fake'};
const event={id:'rawg:outage:2026-11-20',source_id:'rawg',event:'outage',status:'error',
  detail:'INTERNAL SECRET must never appear in a push message',push_attempts:0};
const http=(status=200)=>new Response('{}',{status});

test('ntfy is opt-in: URL and random-length topic must meet basic constraints',()=>{
 assert.equal(ntfyConfig({}),null);
 assert.equal(ntfyConfig({NTFY_TOPIC:'test'}),null);
 assert.equal(ntfyConfig({NTFY_TOPIC:topic,NTFY_SERVER_URL:'http://localhost:8080'}),null);
 assert.equal(ntfyConfig({NTFY_TOPIC:topic,NTFY_SERVER_URL:'https://user:password@ntfy.sh'}),null);
 assert.deepEqual(ntfyConfig({NTFY_TOPIC:topic}),config);
});
test('notice body contains only generic source metadata and can link to protected dashboard',()=>{
 const a=ntfyEventMessage(event);
 assert.match(a.body,/RAWG/);
 assert.equal(a.body.includes(event.detail),false);
 assert.equal(a.priority,'4');
 assert.ok(a.click.startsWith('https://playstation-radar-private.vercel.app/'));
 const b=ntfyEventMessage({...event,id:'rawg:recovered:2026-11-21',event:'recovered'});
 assert.equal(b.priority,'3');
 assert.ok(ntfyTestMessage().body.includes('keine PSN-Kontodaten'));
 assert.throws(()=>ntfyEventMessage({...event,id:'nope'}),/Invalid/);
});
test('post uses only the selected topic URL, fixed headers and a bounded payload',async()=>{
 let observed;
 const fetcher=async(url,options)=>{observed={url,options};return http()};
 await publishNtfy(config,ntfyEventMessage(event),{fetcher});
 assert.equal(observed.url,'https://ntfy.sh/'+topic);
 assert.equal(observed.options.method,'POST');
 assert.ok(!observed.options.body.includes(event.detail));
 assert.ok(!JSON.stringify(observed.options).includes('sb_secret_fake'));
 assert.equal(observed.options.headers.Click,'https://playstation-radar-private.vercel.app/zentrale?tab=quellen');
 await assert.rejects(()=>publishNtfy(config,ntfyTestMessage(),{fetcher:async()=>http(429)}),/HTTP 429/);
});
test('only one worker can claim an incident: persisted push acknowledgement on success',async()=>{
 const calls=[],sent=[];
 const db=async(st,table,query,options={})=>{
  calls.push({table,query,options});
  if(options.method!=='PATCH')return [event];
  if(options.data.push_lease_until)return [event];
  if(options.data.push_sent_at)return [{...event,push_sent_at:options.data.push_sent_at}];
  throw Error('unexpected DB update');
 };
 const output=await deliverPendingNtfy(storage,config,{db,fetcher:async(url,options)=>{sent.push({url,options});return http()},now:new Date('2026-11-21T09:00:00Z')});
 assert.deepEqual({attempted:output.attempted,accepted:output.accepted,failed:output.failed},{attempted:1,accepted:1,failed:0});
 assert.equal(sent.length,1);
 assert.ok(calls.some(x=>x.options.data?.push_sent_at));
 assert.ok(calls.some(x=>x.options.data?.push_lease_token));
 assert.ok(calls.every(x=>!x.options.data||!JSON.stringify(x.options.data).includes('INTERNAL SECRET')));
});
test('failed ntfy request is not marked sent and remains retryable after lease',async()=>{
 const writes=[];
 const db=async(st,table,query,options={})=>{
  if(options.method!=='PATCH')return [event];
  writes.push(options);
  return [event];
 };
 const output=await deliverPendingNtfy(storage,config,{db,fetcher:async()=>http(503)});
 assert.equal(output.failed,1);
 assert.equal(output.accepted,0);
 assert.ok(!writes.some(x=>x.data.push_sent_at));
 assert.ok(writes.some(x=>x.data.push_last_error==='HTTP 503'));
 assert.equal((await deliverPendingNtfy(storage,null,{db})).configured,false);
});
test('claim conflict skips the send and never treats it as a successful push',async()=>{
 const db=async(st,table,query,options={})=>options.method==='PATCH'?[]:[event];
 const output=await deliverPendingNtfy(storage,config,{db,fetcher:()=>{throw Error('should not call ntfy')}});
 assert.equal(output.attempted,0);
 assert.equal(output.accepted,0);
 assert.equal(output.skipped,1);
});
test('test-push 10 minute cooldown uses one conditional DB update',async()=>{
 const seen=[];
 const db=async(st,table,query,options)=>{seen.push({table,query,options});return seen.length===1?[{id:'default'}]:[]};
 const at=new Date('2026-11-21T12:00:00Z');
 assert.equal(await reservePushTest(storage,{db,now:at}),true);
 assert.equal(await reservePushTest(storage,{db,now:at}),false);
 assert.equal(seen[0].table,'pushControl');
 assert.match(seen[0].query,/last_test_at=lt/);
 assert.equal(seen[0].options.method,'PATCH');
 assert.equal(seen[0].options.prefer,'return=representation');
});
