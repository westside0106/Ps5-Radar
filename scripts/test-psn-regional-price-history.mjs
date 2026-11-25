import test from 'node:test';
import assert from 'node:assert/strict';
import {
 regionalHistoryConfig,regionalHistoryIdentity,acceptedRegionalObservations,
 recordRegionalPriceObservation,readRegionalPriceHistory,summarizeRegionalHistory
} from '../lib/psn-regional-price-history.mjs';
const on='2026-11-25T19:35:08.000Z';
const url='https://store.playstation.com/de-de/concept/10001234';
const gb='https://store.playstation.com/en-gb/concept/10001234';
const identity=regionalHistoryIdentity('Cyberpunk 2077',url);
const snapshot={status:'provider-results',match:'concept-id',observedAt:on,
 providerCached:false,rows:[
  {region:'DE',currency:'EUR',price:29.99,original:59.99,discountPct:50,
   evidence:'provider-reported',link:url,suspicious:false},
  {region:'GB',currency:'GBP',price:24.99,original:null,discountPct:null,
   evidence:'provider-reported',link:gb,suspicious:false},
  {region:'US',currency:'USD',price:null,evidence:'unavailable',link:null,suspicious:false},
  {region:'PL',currency:'PLN',price:0,evidence:'provider-reported',
   link:'https://store.playstation.com/pl-pl/concept/10001234',suspicious:false}
 ]};
const storage={url:'https://example.supabase.co/rest/v1/psn_regional_price_history',secret:'test-non-live'};
test('the private Supabase table config uses only exact project hosts and server-side secret',()=>{
 assert.deepEqual(regionalHistoryConfig({SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SECRET_KEY:'safe'}),{
  url:storage.url,secret:'safe'
 });
 for(const host of ['http://example.supabase.co','https://example.supabase.co.attacker.test',
  'https://example.supabase.co/my-path','https://bad.tld']){
  assert.equal(regionalHistoryConfig({SUPABASE_URL:host,SUPABASE_SECRET_KEY:'abc'}),null);
 }
 assert.equal(regionalHistoryConfig({SUPABASE_URL:'https://example.supabase.co'}),null);
});
test('history keys distinguish exact Sony concept/product identity and different named editions',()=>{
 assert.ok(/^reg-[a-f0-9]{64}$/.test(identity.key));
 assert.equal(identity.lookupType,'concept');
 assert.equal(identity.key,regionalHistoryIdentity('  Different Localized Name ',url).key);
 const base=regionalHistoryIdentity('Cyberpunk 2077');
 const ultimate=regionalHistoryIdentity('Cyberpunk 2077 Ultimate Edition');
 assert.notEqual(base.key,ultimate.key);
 assert.notEqual(base.key,identity.key);
 const product=regionalHistoryIdentity('Cyberpunk 2077',
  'https://store.playstation.com/en-us/product/UP0000-PPSA00110_00-REALLYREALGAME01');
 assert.notEqual(product.key,identity.key);
 assert.equal(regionalHistoryIdentity('x'),null);
});
test('only valid source-marked nonzero per-region prices persist, never fake free, wrong currency or bad links',()=>{
 const rows=acceptedRegionalObservations(snapshot,identity);
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.region),['DE','GB']);
 assert.equal(rows[0].price,29.99);
 assert.equal(rows[0].discount_pct,50);
 assert.equal(rows[0].original_price,59.99);
 assert.equal(rows[0].observed_day,'2026-11-25');
 assert.equal(rows[0].match_quality,'concept-id');
 assert.ok(rows.every(x=>x.source_type==='external-unverified'));
 assert.deepEqual(acceptedRegionalObservations({...snapshot,status:'unavailable'},identity),[]);
 assert.deepEqual(acceptedRegionalObservations({...snapshot,match:'unverified-review'},identity),[]);
 assert.deepEqual(acceptedRegionalObservations(snapshot,null),[]);
 const deceptive={...snapshot,rows:[
  {...snapshot.rows[0],link:'https://store.playstation.com.evil.com/de-de/concept/10001234'},
  {...snapshot.rows[1],currency:'USD'},
  {...snapshot.rows[0],region:'US'}
 ]};
 assert.deepEqual(acceptedRegionalObservations(deceptive,identity),[]);
});
test('a single opt-in POST only uses server-normalized values and upserts each UTC day',async()=>{
 let request,callCount=0;
 const receipt=await recordRegionalPriceObservation(storage,snapshot,identity,{
  fetcher:async(url,opts)=>{
   callCount++;request={url,opts};return {ok:true,status:201}
  }
 });
 assert.equal(callCount,1);
 assert.equal(receipt.saved,2);
 assert.equal(receipt.observedDay,'2026-11-25');
 assert.equal(request.opts.method,'POST');
 assert.ok(request.url.endsWith('?on_conflict=game_key,region,observed_day'));
 assert.equal(request.opts.headers.Prefer,'resolution=merge-duplicates,return=minimal');
 assert.ok(!request.url.includes(storage.secret));
 const body=JSON.parse(request.opts.body);
 assert.ok(body.every(x=>x.game_key===identity.key));
 assert.ok(body.every(x=>x.source==='imbbloh/ps-prices'));
 assert.ok(!request.opts.body.includes('NPWR'));
 assert.ok(!request.opts.body.includes('OAuth'));
 assert.equal((await recordRegionalPriceObservation(storage,{...snapshot,status:'unavailable'},identity,
  {fetcher:async()=>{throw Error('must not write')}})).saved,0);
});
test('history reads a bounded 90-day window, scoped by private game identity',async()=>{
 let url,opts;
 const sample=acceptedRegionalObservations(snapshot,identity).map(x=>({
  game_key:x.game_key,region:x.region,currency:x.currency,price:x.price,
  discount_pct:x.discount_pct,match_quality:x.match_quality,
  observed_at:x.observed_at,observed_day:x.observed_day,
  source:x.source,source_type:x.source_type
 }));
 const data=await readRegionalPriceHistory(storage,identity,{
  now:new Date('2026-11-25T21:00:00Z'),
  fetcher:async(input,options)=>{url=input;opts=options;
   return {ok:true,json:async()=>sample}
  }
 });
 assert.ok(url.includes('game_key=eq.'+identity.key));
 assert.ok(url.includes('observed_day=gte.2026-08-28'));
 assert.ok(url.includes('limit=360'));
 assert.equal(opts.cache,'no-store');
 assert.equal(data.days,1);
 assert.equal(data.sampleCount,2);
 assert.equal(data.firstDay,'2026-11-25');
 assert.equal(data.points[0].currency,'EUR');
 assert.ok(!JSON.stringify(data).includes('test-non-live'));
});
test('archive does not reinterpret unknown days, foreign games or stale readings as daily prices',()=>{
 const rows=acceptedRegionalObservations(snapshot,identity).map(x=>({
  game_key:x.game_key,region:x.region,currency:x.currency,
  price:x.price,observed_at:x.observed_at,observed_day:x.observed_day,
  source:x.source,source_type:x.source_type,match_quality:x.match_quality
 }));
 const data=summarizeRegionalHistory([
  ...rows,
  {...rows[0],game_key:'reg-'+'a'.repeat(64),price:0.01},
  {...rows[0],observed_day:'2026-01-01',price:0.01},
  {...rows[0],source:'unknown-import',price:0.01},
  {...rows[0],price:0}
 ],identity,{now:new Date('2026-11-25T21:00:00Z')});
 assert.equal(data.days,1);
 assert.equal(data.sampleCount,2);
 assert.equal(data.periodDays,90);
 assert.equal(data.points.filter(x=>x.region==='DE').length,1);
 assert.equal(summarizeRegionalHistory([],identity,{now:new Date('2026-11-25T21:00:00Z')}).days,0);
});
