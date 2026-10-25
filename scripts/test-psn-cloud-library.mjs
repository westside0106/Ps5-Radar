import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudHeaders,validCloudPayload} from '../lib/psn-cloud-helpers.mjs';
import {getPsnDigitalLibrary,getPsnDashboard,getPsnGameTrophies} from '../lib/psn-server.mjs';

test('secret Supabase keys use apikey only; legacy JWTs retain bearer header',()=>{
 const opaque=cloudHeaders('sb_secret_test-only');
 assert.equal(opaque.apikey,'sb_secret_test-only');
 assert.equal(opaque.Authorization,undefined);
 const legacy=cloudHeaders('legacy-service-role-jwt');
 assert.equal(legacy.Authorization,'Bearer legacy-service-role-jwt');
});
test('cloud schema includes cover URLs and chronological playtime snapshots',()=>{
 assert.ok(validCloudPayload({notes:{a:{status:'platinum',priority:'high'}},history:[{date:'2026-10-25',games:97,minutes:150}],covers:{a:'steamgriddb'},coverUrls:{a:'https://cdn2.steamgriddb.com/grid/example.png'},trophyTargets:{a:['1']},platinumChecks:{a:['2']},manualGames:[{titleId:'custom:unplayed-game',name:'Unplayed Game'}]}));
 assert.ok(validCloudPayload({notes:null,history:null,covers:null,coverUrls:null,trophyTargets:null}));
 assert.equal(validCloudPayload({history:{date:'2026-10-25'}}),false);
 assert.equal(validCloudPayload({coverUrls:[]}),false);
 assert.equal(validCloudPayload({manualGames:{}}),false);
});
test('Sony library requests active digital entitlements with current persisted query and correct pagination',async()=>{
 const original=globalThis.fetch,oldNpsso=process.env.PSN_NPSSO;
 process.env.PSN_NPSSO='A'.repeat(64);
 const seen=[];
 const reply=body=>({ok:true,status:200,json:async()=>body});
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/authorize'))return {headers:{get:name=>name==='location'?'https://example.test/redirect?code=unit-test':null}};
  if(url.pathname.endsWith('/token'))return reply({access_token:'unit-test-token'});
  assert.equal(url.hostname,'web.np.playstation.com');
  assert.equal(options.headers.Authorization,'Bearer unit-test-token');
  assert.equal(options.headers['apollo-require-preflight'],'true');
  assert.equal(url.searchParams.get('operationName'),'getPurchasedGameList');
  const vars=JSON.parse(url.searchParams.get('variables'));
  const hash=JSON.parse(url.searchParams.get('extensions')).persistedQuery.sha256Hash;
  assert.equal(hash,'827a423f6a8ddca4107ac01395af2ec0eafd8396fc7fa204aaf9b7ed2eefa168');
  assert.equal(vars.membership,undefined);
  assert.equal(vars.subscriptionService,undefined);
  assert.deepEqual(vars.platform,['ps4','ps5']);
  seen.push(vars.start);
  const games=Array.from({length:vars.start===0?50:1},(_,i)=>({titleId:'TEST'+(vars.start+i),name:'Game '+(vars.start+i)}));
  return reply({data:{purchasedTitlesRetrieve:{games,pageInfo:{totalCount:51,isLast:vars.start>0}}}});
 };
 try{
  const data=await getPsnDigitalLibrary();
  assert.equal(data.titles.length,51);
  assert.equal(data.complete,true);
  assert.deepEqual(seen,[0,50]);
 }finally{
  globalThis.fetch=original;
  if(oldNpsso===undefined)delete process.env.PSN_NPSSO;else process.env.PSN_NPSSO=oldNpsso;
 }
});


test('played PSN games paginate beyond the first 100 and preserve each title',async()=>{
 const before=globalThis.fetch,old=process.env.PSN_NPSSO;
 process.env.PSN_NPSSO='C'.repeat(64);
 const offsets=[];
 const json=value=>({ok:true,json:async()=>value});
 globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/authorize'))return {headers:{get:k=>k==='location'?'https://localhost.test/redirect?code=played-test':null}};
  if(url.pathname.endsWith('/token'))return json({access_token:'unit-test'});
  if(url.pathname.endsWith('/trophySummary'))return json({earnedTrophies:{}});
  if(url.pathname.endsWith('/trophyTitles'))return json({trophyTitles:[]});
  if(url.pathname.includes('/gamelist/v2/users/me/titles')){
   const offset=Number(url.searchParams.get('offset')||0);
   offsets.push(offset);
   const length=offset===0?100:51;
   return json({titles:Array.from({length},(_,i)=>({titleId:'TEST'+(offset+i),name:'Test game '+(offset+i),playDuration:'PT1H'})),totalItemCount:151});
  }
  throw Error('Unexpected mocked PSN call: '+url.pathname);
 };
 try{
  const data=await getPsnDashboard({force:true});
  assert.equal(data.played.titles.length,151);
  assert.equal(data.played.paginationComplete,true);
  assert.deepEqual(offsets,[0,100]);
  assert.equal(new Set(data.played.titles.map(g=>g.titleId)).size,151);
 }finally{
  globalThis.fetch=before;
  if(old===undefined)delete process.env.PSN_NPSSO;else process.env.PSN_NPSSO=old;
 }
});
test('explicit Sony trophy refresh skips cached response',async()=>{
 const before=globalThis.fetch,old=process.env.PSN_NPSSO;
 process.env.PSN_NPSSO='D'.repeat(64);
 let catalogRequests=0;
 const json=value=>({ok:true,json:async()=>value});
 globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/authorize'))return {headers:{get:k=>k==='location'?'https://localhost.test/redirect?code=refresh-test':null}};
  if(url.pathname.endsWith('/token'))return json({access_token:'unit-test'});
  if(url.pathname.endsWith('/trophyGroups'))return json({trophyGroups:[]});
  if(url.pathname.includes('/npCommunicationIds/')&&url.pathname.endsWith('/trophies')){
   if(!url.pathname.includes('/users/me/'))catalogRequests++;
   return json({trophies:[{trophyId:1,trophyType:'bronze',trophyName:'Sample',earned:false}]});
  }
  throw Error('Unexpected mocked PSN call: '+url.pathname);
 };
 try{
  await getPsnGameTrophies('NPWRCACHE99_00','trophy2');
  await getPsnGameTrophies('NPWRCACHE99_00','trophy2');
  assert.equal(catalogRequests,1);
  await getPsnGameTrophies('NPWRCACHE99_00','trophy2',true);
  assert.equal(catalogRequests,2);
 }finally{
  globalThis.fetch=before;
  if(old===undefined)delete process.env.PSN_NPSSO;else process.env.PSN_NPSSO=old;
 }
});
