import test from 'node:test';
import assert from 'node:assert/strict';
import {
 REGIONAL_STORES,selectedStoreIdentity,validRegionQuery,
 normalizeRegionalResults,fetchRegionalPrices
} from '../lib/psn-region-price-compare.mjs';
const input={
 title:'Cyberpunk 2077',conceptId:'10001234',resolvedBy:'conceptId',priced:4,total:20,
 results:[
  {region:'DE',currency:'EUR',price:29.99,original:59.99,discount:'-50%',
   english:true,via:'concept',url:'https://store.playstation.com/de-de/concept/10001234',
   editions:[{price:29.99},{price:39.99}]},
  {region:'GB',currency:'GBP',price:24.99,original:null,
   english:null,via:'concept',url:'https://store.playstation.com/en-gb/concept/10001234'},
  {region:'US',currency:'USD',price:19.99,original:49.99,
   english:false,via:'search',url:'https://store.playstation.com/en-us/product/UP0000-PPSA00110_00-REALLYREALGAME01'},
  {region:'PL',currency:'PLN',price:119.99,original:200,
   redirected:true,via:'concept',url:'https://store.playstation.com/pl-pl/concept/10001234'}
 ]
};
test('only Sony concept and product URLs are accepted, never arbitrary hosts or account URLs',()=>{
 assert.deepEqual(selectedStoreIdentity('https://store.playstation.com/de-de/concept/10001234'),
  {type:'concept',value:'10001234'});
 assert.deepEqual(selectedStoreIdentity('https://store.playstation.com/en-us/product/UP0000-PPSA00110_00-REALLYREALGAME01'),
  {type:'product',value:'UP0000-PPSA00110_00-REALLYREALGAME01'});
 for(const invalid of [
  'https://store.playstation.com.evil.org/de-de/concept/10001234',
  'http://store.playstation.com/de-de/concept/10001234',
  'https://user:pass@store.playstation.com/de-de/concept/10001234',
  'https://store.playstation.com/de-de/concept/../10001234',
  'https://store.playstation.com/de-de/concept/10001234?account=123',
  'https://store.playstation.com/en-us/checkout?token=secret',
  'https://evil.example/concept/10001234'
 ])assert.equal(selectedStoreIdentity(invalid),null);
 assert.equal(validRegionQuery('Cyberpunk 2077'),true);
 assert.equal(validRegionQuery('x'),false);
 assert.equal(validRegionQuery('A'.repeat(121)),false);
});
test('regional prices are presented in native currency, no FX or cross-currency ranking',()=>{
 const r=normalizeRegionalResults(input,{title:'Cyberpunk 2077',
  identity:{type:'concept',value:'10001234'},
  observedAt:'2026-11-25T00:00:00Z'});
 assert.equal(r.rows.length,4);
 assert.deepEqual(r.rows.map(x=>x.region),['DE','GB','US','PL']);
 assert.equal(r.match,'concept-id');
 assert.equal(r.reviewRequired,true);
 assert.equal(r.observedAt,'2026-11-25T00:00:00Z');
 assert.equal(r.rows[0].price,29.99);
 assert.equal(r.rows[0].currency,'EUR');
 assert.equal(r.rows[0].discountPct,50);
 assert.equal(r.rows[0].editionsCount,2);
 assert.equal(r.rows[1].price,24.99);
 assert.equal(r.rows[2].price,19.99);
 assert.equal(r.rows[3].price,null,'redirected PLN must not be reported as a verified price');
 assert.ok(!Object.hasOwn(r,'convertedPrice'));
 assert.ok(!Object.hasOwn(r,'bestPrice'));
});
test('wrong currency, third-party URL, suspicious addon and foreign locale never become valid price data',()=>{
 const data={...input,results:[
  {region:'DE',currency:'USD',price:1,url:'https://store.playstation.com/de-de/concept/10001234'},
  {region:'GB',currency:'GBP',price:0,suspect:false,url:'https://store.playstation.com/en-gb/concept/10001234'},
  {region:'US',currency:'USD',price:1,url:'https://evil.com/en-us/concept/10001234'},
  {region:'PL',currency:'PLN',price:60,url:'https://store.playstation.com/de-de/concept/10001234'}
 ]};
 const r=normalizeRegionalResults(data,{title:'Cyberpunk 2077'});
 assert.ok(r.rows.every(x=>x.price===null));
 assert.ok(r.rows.every(x=>x.link===null||x.link.startsWith('https://store.playstation.com/')));
 assert.equal(r.match,'title-review');
});
test('unknown or duplicated regional observations never inject price or credential fields',()=>{
 const data={...input,results:[
  {region:'US',currency:'USD',price:55,url:'https://store.playstation.com/en-us/concept/10001234'},
  {region:'US',currency:'USD',price:1,url:'https://store.playstation.com/en-us/concept/10001234'},
  {region:'AA',currency:'EUR',price:1,url:'https://evil.org'}
 ]};
 const r=normalizeRegionalResults(data,{title:'Different Edition'});
 assert.equal(r.rows[2].price,55);
 assert.equal(r.rows[0].price,null);
 assert.equal(r.match,'unverified-review');
 assert.equal(r.reviewRequired,true);
 for(const item of r.rows)assert.ok(!('userToken' in item));
 assert.throws(()=>normalizeRegionalResults({results:'wrong'}),/Invalid external regional response/);
 assert.throws(()=>normalizeRegionalResults({results:Array(31).fill({})}),/Invalid external regional response/);
});
test('request sends only supplied title or validated concept ID to fixed API, not personal PSN context',async()=>{
 let captured;
 const fetcher=async(url,opts)=>{
  captured={url,opts};return {
   ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(input)
  };
 };
 const r=await fetchRegionalPrices('Cyberpunk 2077',{
  storeUrl:'https://store.playstation.com/de-de/concept/10001234',
  fetcher,now:()=>1795564800000
 });
 assert.equal(captured.url,'https://ps-prices-api.onrender.com/prices?title=10001234');
 assert.equal(captured.opts.cache,'no-store');
 assert.equal(r.status,'provider-results');
 assert.equal(r.match,'concept-id');
 assert.ok(!JSON.stringify(captured).includes('PSN_ACCESS_TOKEN'));
});
test('provider outage is explicitly unavailable and cannot generate an EUR price alarm',async()=>{
 const a=await fetchRegionalPrices('Other Test Game',{
  fetcher:async()=>({ok:false,status:502}),now:()=>1795564801000
 });
 assert.equal(a.status,'unavailable');
 assert.deepEqual(a.rows,[]);
 const b=await fetchRegionalPrices('Unavailable Test Game',{
  fetcher:async()=>{throw Error('timeout')},now:()=>1795564801000
 });
 assert.equal(b.status,'unavailable');
 assert.deepEqual(b.rows,[]);
 const c=await fetchRegionalPrices('Broken Test Game',{
  fetcher:async()=>({ok:true,headers:{get:()=>null},text:async()=>'<html>Oops</html>'}),
  now:()=>1795564801000
 });
 assert.equal(c.status,'unavailable');
 await assert.rejects(()=>fetchRegionalPrices('x'),/Invalid game title/);
});
test('upstream HTTP redirect is not followed and no personal data is forwarded',async()=>{
 const a=await fetchRegionalPrices('Redirect Test Game',{fetcher:async(url,opts)=>{
  assert.equal(opts.redirect,'error');return {ok:false,status:302}
 },now:()=>1795564801000});
 assert.equal(a.status,'unavailable');
});
