import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyXboxSnapshot,fromVerifiedXboxObservations,collectXboxSnapshot} from '../adapter.mjs';
const raw=()=>JSON.parse(readFileSync(new URL('../fixtures/synthetic.json',import.meta.url),'utf8'));
test('empty Xbox snapshot is explicitly incomplete',()=>{
 const s=emptyXboxSnapshot('2026-09-08T12:00:00Z');
 assert.equal(s.coverage.complete,false);assert.equal(s.products.length,0);
});
test('adapter accepts only explicitly Xbox DE observations',()=>{
 assert.equal(fromVerifiedXboxObservations(raw()).products[0].platform,'xbox');
 const ps=raw();ps.platform='ps';assert.throws(()=>fromVerifiedXboxObservations(ps),/Xbox DE/);
 const region=raw();region.region='US';assert.throws(()=>fromVerifiedXboxObservations(region),/Xbox DE/);
});
test('a failed source run yields an explicitly incomplete snapshot, never invented data',async()=>{
 // Unbekannte Sicht: der Lauf erreicht die Quelle nicht und darf trotzdem
 // nichts erfinden - kein Produkt, kein Angebot, keine Berechtigung.
 const snapshot=await collectXboxSnapshot(['gibt-es-nicht']);
 assert.equal(snapshot.platform,'xbox');
 assert.equal(snapshot.coverage.complete,false);
 assert.deepEqual(snapshot.products,[]);
 assert.deepEqual(snapshot.offers,[]);
 assert.deepEqual(snapshot.entitlements,[]);
 assert.ok(snapshot.coverage.errors.some(message=>/gibt-es-nicht/.test(message)));
});
