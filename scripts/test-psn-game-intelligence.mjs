import test from 'node:test';
import assert from 'node:assert/strict';
import {
 cleanGameTitle,gameSlug,fpsEvidenceFor,storeSnapshotFor,storeRelatedEditionsFor,priceRadarReferenceFor,
 hltbCandidates,getHltbEstimates,getGameIntelligence,
 getFramePatchSnapshot,getStoreCatalogSnapshot
} from '../lib/psn-game-intelligence.mjs';

const fpsFixture={source:'fpsRecords',syncedAt:'2026-10-26T21:52:31.206Z',entries:{
 '337':{data:{slug:'cyberpunk-2077',lastVerified:'2026-08-26',
  entries:[
   {platform:'ps5',modelId:'ps5',fps:60,appType:'native',confidence:'measured',
    modes:[{name:'Performance',targetFps:60,unlocked:true,vrr:true,resolution:'1440p',note:'45–60 FPS observed'},
      {name:'Quality',targetFps:30,vrr:false,unlocked:false,resolution:'4K'}]},
   {platform:'ps5',modelId:'ps5-pro',fps:60,appType:'native',confidence:'reported',
    modes:[{name:'Ray Tracing',targetFps:60}]},
   {platform:'xbox',modelId:'xbox-series-x',fps:60,modes:[{name:'Performance',targetFps:60}]}
  ],
  evidence:[
   {url:'https://www.digitalfoundry.net/articles/cyberpunk',title:'Independent test',publisher:'Digital Foundry'},
   {url:'https://evil.org/fps-hack',title:'Invalid source',publisher:'Fake'}
  ],patches:[
   {version:'2.31',date:'2026-04-08',previousFps:30,newFps:60,changedFps:true,
    url:'https://prosperopatches.com/PPSA03974'}
  ]
 }}
}};
const storeFixture=[
 {name:'Cyberpunk 2077',price:'$49.99',href:'https://store.playstation.com/en-us/product/UP0000-VALIDGAME00000',platforms:['PS5'],type:'game'},
 {name:'Cyberpunk 2077 Ultimate Edition',price:'$79.99',
  href:'https://store.playstation.com/en-us/product/UP0000-ULTIMATEGAME',platforms:['PS5']},
 {name:'Cyberpunk 2077: Phantom Liberty',price:'$29.99',
  href:'https://store.playstation.com/en-us/product/UP0000-DLCGAME',platforms:['PS5']},
 {name:'Cyberpunk 2077 Gold Edition',price:'$64.99',
  href:'https://store.playstation.com/en-us/product/UP0000-GOLDGAME',platforms:['PS4','PS5']},
 {name:'Cyberpunk 2077 2',price:'$79.99',
  href:'https://store.playstation.com/en-us/product/UP0000-SECONDGAME',platforms:['PS5']},
 {name:'Cyberpunk 2077 Ultimate Edition',price:'$0.01',
  href:'https://store.playstation.com/en-gb/product/INVALID',platforms:['PS5']},
 {name:'Cyberpunk 2077',price:'$20.00',href:'https://store.playstation.com/en-gb/product/EX0000',platforms:['PS5']},
 {name:'Cyberpunk 2077',price:'$0.00',href:'https://evil.org/game',platforms:['PS5']}
];

test('game-title normalization keeps editions separate and strips PS platform suffixes only',()=>{
 assert.equal(cleanGameTitle(' Cyberpunk® 2077 (PS5) '),'Cyberpunk 2077');
 assert.equal(gameSlug('Assassin’s Creed Shadows'),'assassins-creed-shadows');
 assert.equal(gameSlug('Cyberpunk 2077 Ultimate Edition'),'cyberpunk-2077-ultimate-edition');
 assert.notEqual(gameSlug('Cyberpunk 2077'),gameSlug('Cyberpunk 2077 Ultimate Edition'));
 assert.equal(gameSlug("Assassin's Creed Shadows"),gameSlug('Assassin’s Creed Shadows'));
});
test('FramePatch snapshot keeps independently verified PS5 and Pro records and evidence, not Xbox or assumptions',()=>{
 const r=fpsEvidenceFor('Cyberpunk® 2077 (PS5)',fpsFixture);
 assert.ok(r);
 assert.equal(r.entries.length,2);
 assert.equal(r.entries[0].fps,60);
 assert.equal(r.entries[0].confidence,'measured');
 assert.equal(r.entries[0].modes[0].unlocked,true);
 assert.equal(r.entries[1].model,'PS5 Pro');
 assert.equal(r.patch.previousFps,30);
 assert.equal(r.evidence.length,1);
 assert.equal(r.lastVerified,'2026-08-26');
 assert.equal(fpsEvidenceFor('Cyberpunk 2077 Ultimate Edition',fpsFixture),null);
});
test('multiple FramePatch records with the same slug are ambiguous and are not auto-assigned',()=>{
 const duplicates={...fpsFixture,entries:{...fpsFixture.entries,'338':fpsFixture.entries['337']}};
 assert.equal(fpsEvidenceFor('Cyberpunk 2077',duplicates),null);
});
test('Store snapshot is exact-title, US-only, displays an observed USD price as historic, never a live DE price',()=>{
 const rows=storeSnapshotFor('Cyberpunk 2077',storeFixture,'2026-11-17T07:08:00.125Z');
 assert.equal(rows.length,1);
 assert.equal(rows[0].usdPrice,49.99);
 assert.equal(rows[0].currency,'USD');
 assert.equal(rows[0].region,'US');
 assert.equal(rows[0].observedAt,'2026-11-17T07:08:00.125Z');
 assert.equal(rows[0].href,'https://store.playstation.com/en-us/product/UP0000-VALIDGAME00000');
 assert.equal(storeSnapshotFor('Cyberpunk 2077 Ultimate Edition',storeFixture,null).length,1);
});
test('related US editions are explicitly distinct candidates, never blended with DLC or another numbered game',()=>{
 const rows=storeRelatedEditionsFor('Cyberpunk 2077',storeFixture,'2026-11-17T07:08:00Z');
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.title).sort(),['Cyberpunk 2077 Gold Edition','Cyberpunk 2077 Ultimate Edition']);
 assert.ok(rows.every(x=>x.relation==='edition-to-verify'&&x.region==='US'&&x.currency==='USD'));
 assert.ok(rows.every(x=>x.href.startsWith('https://store.playstation.com/en-us/product/')));
 assert.ok(!rows.some(x=>x.title.includes('Phantom Liberty')||x.title.endsWith(' 2')));
 assert.equal(storeRelatedEditionsFor('Cyberpunk 2077 Ultimate Edition',storeFixture,null).length,0);
 assert.deepEqual(storeRelatedEditionsFor('Cyberpunk 2077',null,null),[]);
});

test('EUR Radar links only an exact monitored edition; it does not treat US snapshot USD as a German deal',()=>{
 const now=new Date('2026-11-24T12:00:00Z');
 const source={
  'Cyberpunk 2077':{points:[{date:'2026-11-19',price:39.99},{date:'2026-11-23',price:24.99}],
   signal:{activeDeal:true,currentPrice:24.99,lastObservedDate:'2026-11-23',radarLow:19.99}},
  'Cyberpunk 2077 Ultimate Edition':{points:[{date:'2026-11-10',price:69.99}],
   signal:{activeDeal:false,currentPrice:null,radarLow:69.99}}
 };
 const base=priceRadarReferenceFor('Cyberpunk 2077 (PS5)',source,now);
 assert.equal(base.title,'Cyberpunk 2077');
 assert.equal(base.historyCount,2);
 assert.equal(base.currentVerifiedPrice,24.99);
 assert.equal(base.radarLow,19.99);
 assert.equal(base.priceGoalUrl,'/zentrale?tab=preise&game=Cyberpunk%202077');
 const ultimate=priceRadarReferenceFor('Cyberpunk 2077 Ultimate Edition',source,now);
 assert.equal(ultimate.currentVerifiedPrice,null);
 assert.equal(ultimate.historyCount,1);
 assert.equal(priceRadarReferenceFor('Cyberpunk 2077 Phantom Liberty',source,now),null);
 const later=priceRadarReferenceFor('Cyberpunk 2077',source,new Date('2026-11-29T12:00:00Z'));
 assert.equal(later.currentVerifiedPrice,null,'Stale deals may not trigger EUR price goals');
 const ambiguous={...source,'Cyberpunk® 2077':source['Cyberpunk 2077']};
 assert.equal(priceRadarReferenceFor('Cyberpunk 2077',ambiguous,now),null);
});

test('Provider entry fetchers use hardcoded official-source paths with no account data',async()=>{
 const fps=await getFramePatchSnapshot('Cyberpunk 2077',{load:async(url)=>{
  assert.equal(url,'https://raw.githubusercontent.com/arthurcarlsonn/framepatch/main/data/fpsRecords.json');
  return fpsFixture;
 }});
 assert.equal(fps.match.entries[0].fps,60);
 const urls=[];
 const store=await getStoreCatalogSnapshot('Cyberpunk 2077',{
  load:async url=>{urls.push(url);return url.endsWith('.json')&&url.endsWith('%24.json')
   ?{date:'2026-11-17T07:08:00.125Z'}:storeFixture}
 });
 assert.equal(urls.length,2);
 assert.ok(urls.every(x=>!x.includes('NPWR')&&!x.includes('token')));
 assert.equal(store.matches.length,1);
 assert.equal(store.relatedEditions.length,2);
 assert.equal(store.relatedEditions[0].relation,'edition-to-verify');
 assert.equal(store.snapshotAt,'2026-11-17T07:08:00.125Z');
});
test('HowLongToBeat converts seconds to hours but does not falsely equate community 100% with platinum',()=>{
 const games={data:[
  {game_id:1200,game_name:'Cyberpunk 2077',comp_main:126000,comp_plus:252000,comp_100:360000,
   comp_main_count:50,comp_100_count:12},
  {game_id:1201,game_name:'Cyberpunk 2077: Phantom Liberty',comp_main:80000}
 ]};
 const r=hltbCandidates('Cyberpunk 2077',games);
 assert.equal(r.length,1);
 assert.equal(r[0].mainHours,35);
 assert.equal(r[0].extrasHours,70);
 assert.equal(r[0].completionistHours,100);
 assert.equal(r[0].sourceUrl,'https://howlongtobeat.com/game/1200');
 assert.deepEqual(hltbCandidates('Cyberpunk 2077',{data:[]}),[]);
});
test('live unofficial HLTB flow sends only game title and ephemeral returned auth headers',async()=>{
 let count=0;
 const fetcher=async(url,opts)=>{
  count++;
  assert.ok(url.startsWith('https://howlongtobeat.com/api/search/site'));
  if(count===1)return {ok:true,json:async()=>({token:'one-time-test-token',hpKey:'key_field',hpVal:'key_value'})};
  assert.equal(opts.method,'POST');
  assert.equal(opts.headers['X-Hp-Key'],'key_field');
  assert.equal(opts.headers['X-Hp-Val'],'key_value');
  assert.equal(opts.headers['X-Auth-Token'],'one-time-test-token');
  const body=JSON.parse(opts.body);
  assert.deepEqual(body.searchTerms,['Cyberpunk','2077']);
  assert.equal(body.key_field,'key_value');
  assert.equal(opts.body.includes('NPWR'),false);
  return {ok:true,json:async()=>({data:[{game_id:1200,game_name:'Cyberpunk 2077',
   comp_main:108000,comp_plus:180000,comp_100:324000}]})};
 };
 const r=await getHltbEstimates('Cyberpunk 2077',{fetcher});
 assert.equal(count,2);
 assert.equal(r.status,'ready');
 assert.equal(r.matches[0].mainHours,30);
 assert.equal(r.matches[0].completionistHours,90);
});
test('HLTB blocked/fingerprint failures are unknown, not invented hours',async()=>{
 const blocked=await getHltbEstimates('Cyberpunk 2077',{fetcher:async()=>({ok:false,status:403})});
 assert.equal(blocked.status,'unavailable');assert.equal(blocked.matches.length,0);
 const malformed=await getHltbEstimates('Cyberpunk 2077',{fetcher:async()=>({
  ok:true,json:async()=>({token:'only-token'})})});
 assert.equal(malformed.status,'unavailable');
});
test('one failing provider does not erase FPS, Store and other usable data',async()=>{
 const r=await getGameIntelligence('Cyberpunk 2077',{
  fps:async()=>({source:'framepatch',match:{entries:[{fps:60}]}}),
  store:async()=>({matches:[{title:'Cyberpunk 2077',usdPrice:49.99}]}),
  hltb:async()=>{throw Error('token=dont-return')}
 });
 assert.equal(r.framepatch.match.entries[0].fps,60);
 assert.equal(r.store.matches.length,1);
 assert.equal(r.howlongtobeat.status,'unavailable');
 assert.equal(JSON.stringify(r).includes('dont-return'),false);
 await assert.rejects(()=>getGameIntelligence('x'),/Invalid title/);
});
