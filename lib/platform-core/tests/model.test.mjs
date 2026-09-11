import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSnapshot,normalizeOffer,productKey,datedEventBadge,offerDiscount,activeOffer,entitlementAvailable} from '../model.mjs';
import {selectProducts,selectOffers,selectEntitlements,sourceHealth} from '../view.mjs';
import {platformFromUrl,platformRoute} from '../platforms.mjs';
const raw=JSON.parse(readFileSync(new URL('../../providers/xbox/fixtures/synthetic.json',import.meta.url),'utf8'));
const fixture=()=>structuredClone(raw);
test('namespaced identities and platform routes stay separate',()=>{
 assert.equal(productKey('ps','product','ABC'),'ps:product:ABC');
 assert.equal(productKey('xbox','product','ABC'),'xbox:product:ABC');
 assert.notEqual(productKey('ps','product','ABC'),productKey('xbox','product','ABC'));
 assert.equal(platformFromUrl('https://radar.local/radar?platform=xbox'),'xbox');
 assert.equal(platformFromUrl('/radar?platform=unknown'),'ps');
 assert.equal(platformRoute('ps'),' /radar'.trim());
 assert.equal(platformRoute('xbox','preise'),'/xbox/preise');
});
test('snapshot requires evidence and explicit platform targets',()=>{
 assert.equal(normalizeSnapshot(fixture()).products.length,1);
 const wrong=fixture();wrong.products[0].platform='ps';assert.throws(()=>normalizeSnapshot(wrong),/Cross-platform|Explicit supported targets/);
 const missing=fixture();missing.products[0].evidenceIds=['missing'];assert.throws(()=>normalizeSnapshot(missing),/Missing evidence/);
 const target=fixture();target.products[0].targets=['windows-pc'];assert.throws(()=>normalizeSnapshot(target),/Entitlement target/);
});
test('unknown coverage is never complete',()=>{
 const s=fixture();s.coverage.complete=true;assert.equal(normalizeSnapshot(s).coverage.complete,false);
 s.coverage.expected=1;s.coverage.errors=[];assert.equal(normalizeSnapshot(s).coverage.complete,true);
 s.coverage.invalid=1;assert.equal(normalizeSnapshot(s).coverage.complete,false);
});
test('money, discounts and offer expiry are exact',()=>{
 const s=normalizeSnapshot(fixture());const o=s.offers[0];
 assert.equal(offerDiscount(o),50);
 assert.equal(activeOffer(o,new Date('2026-09-09T12:00:00Z')),true);
 assert.equal(activeOffer(o,new Date('2026-09-10T00:00:00Z')),false);
 assert.equal(selectOffers(s,{target:'windows-pc'}).length,0);
 assert.throws(()=>normalizeOffer({...o,priceMinor:19.99}),/integer/);
 assert.throws(()=>normalizeOffer({...o,regularPriceMinor:100}),/Regular price/);
});
test('entitlements do not imply ownership or other platforms',()=>{
 const s=normalizeSnapshot(fixture());const e=s.entitlements[0];
 assert.equal(e.accessKind,'catalog');
 assert.equal(entitlementAvailable(e,'xbox-series',new Date('2026-09-09T00:00:00Z')),true);
 assert.equal(entitlementAvailable(e,'windows-pc'),false);
 assert.equal(selectEntitlements(s,{serviceId:'synthetic-service',target:'windows-pc'}).length,0);
 assert.equal(selectProducts(s,{target:'xbox-series'}).length,1);
});
test('today labels require an actual verified event date',()=>{
 const now=new Date('2026-09-07T22:30:00Z');
 assert.equal(datedEventBadge({verified:true,eventDate:'2026-09-08',kind:'release'},now),'HEUTE NEU');
 assert.equal(datedEventBadge({verified:true,eventDate:'2026-09-08',kind:'deadline'},now),'HEUTE RELEVANT');
 assert.equal(datedEventBadge({verified:false,eventDate:'2026-09-08'},now),'AKTUELL');
 assert.equal(datedEventBadge({verified:true,eventDate:'2026-09-07'},now),'SEIT 07.09.');
});
test('stale status is separate from completeness',()=>{
 const s=normalizeSnapshot(fixture());
 const h=sourceHealth(s,new Date('2026-09-11T12:00:00Z'));
 assert.equal(h.stale,true);assert.equal(h.complete,false);
});
