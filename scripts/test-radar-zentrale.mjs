import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIndex,buildEvents,evaluateRules,findEntries,normalizeRules,sourceSummary} from '../lib/radar-zentrale.mjs';

const sample={
 catalog:{checkedAt:'2026-10-25T08:00:00Z',sections:{extra:{complete:true}},games:[{id:'concept:1',title:'Example PS5',services:['extra'],storeUrl:'https://store.playstation.com/a',releaseDate:'2020-01-01'}],
  changes:[{id:'concept:1',title:'Example PS5',kind:'added',date:'2026-10-20T09:00:00Z',service:'extra'},
   {id:'concept:2',title:'Old Game',kind:'removed',date:'2026-10-21T09:00:00Z',service:'extra'}]},
 xbox:{checkedAt:'2026-10-25T10:00:00Z',coverage:{complete:false},games:[{id:'xb2',title:'Example PS5 Deluxe Edition',priceMinor:1299,services:[]}]},
 prices:{updatedAt:'2026-10-26T09:00:00Z',games:{'Example PS5':{title:'Example PS5',signal:{activeDeal:false,lastObservedPrice:9.99,radarLow:9.99}}}},
 archive:[{id:'010',edition:'Ausgabe 10',lead:'Example PS5 erscheint',date:'10.10.2026'}],
 radar:{leadTitle:'Example PS5',storeEnd:'2026-10-29',health:{status:'ok',checkedAt:'2026-10-26T10:00:00Z'}}
};
test('universal index keeps platform, product and historical price records separate',()=>{
 const result=buildIndex(sample);
 assert.ok(result.length>=5);
 assert.ok(result.some(x=>x.kind==='psplus'&&x.url.startsWith('/ps-plus?tab=extra&q=')));
 assert.ok(result.some(x=>x.kind==='xbox'&&x.title.includes('Deluxe')));
 assert.ok(result.some(x=>x.kind==='price'&&x.price===null),'stale last-observed price must not look current');
 assert.equal(findEntries(result,'Example PS5','all').length>=4,true);
 assert.equal(findEntries(result,'Example PS5','xbox').length,1);
 assert.equal(findEntries(result,'', 'all').length,0);
 assert.equal(findEntries(result,'missing game','all').length,0);
});
test('calendar distinguishes observed catalog removal from a future announced departure',()=>{
 const e=buildEvents(sample);
 assert.equal(e.filter(x=>x.type==='catalog-removed').length,1);
 assert.ok(e.some(x=>x.type==='catalog-added'&&x.date==='2026-10-20'));
 assert.ok(e.some(x=>x.type==='sale-ending'&&x.date==='2026-10-29'));
 assert.equal(e.filter(x=>x.type==='catalog-leaving').length,0);
});
test('price rules only trigger on confirmed active prices, never on historical prices',()=>{
 const rules=normalizeRules([{title:'Example PS5',limit:10},{title:'Example PS5',limit:11},{title:'Bad',limit:-3}]);
 assert.equal(rules.length,1);
 assert.equal(evaluateRules(rules,sample.prices.games)[0].matched,false);
 const fresh={...sample.prices.games,'Example PS5':{signal:{activeDeal:true,currentPrice:9.99}}};
 assert.equal(evaluateRules(rules,fresh)[0].matched,true);
 assert.equal(evaluateRules(rules,{'Example PS5':{signal:{activeDeal:true,currentPrice:null}}})[0].matched,false);
});
test('source overview exposes incomplete Xbox data rather than pretending full coverage',()=>{
 const items=sourceSummary(sample);
 assert.equal(items.length,4);
 assert.equal(items.find(x=>x.name==='Xbox Beta').complete,false);
});
