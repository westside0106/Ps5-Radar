import test from 'node:test';
import assert from 'node:assert/strict';
import {plusDeadlineOverview} from '../lib/ps-plus-deadline-plan.mjs';

const official='https://blog.de.playstation.com/2026/10/28/playstation-plus-monatliche-spiele-fuer-november-dead-island-2-mehr/';
const monthly={psplusLabel:'NOVEMBER 2026',psplusText:'Verfügbar bis 30.11.',
 plusGames:[{title:'Dead Island 2',storeUrl:'https://store.playstation.com/de-de/concept/201061'},
 {title:'Monster Train 2'}],resolvedSources:{psPlusMonthly:official}};
const base={checkedAt:'2026-11-20T11:31:32.945Z',
 sourceUrl:'https://www.playstation.com/de-de/ps-plus/games/',
 sections:{extra:{complete:true},classics:{complete:true}},games:[]};
const on=(day)=>new Date(day+'T10:00:00Z');

test('monthly Essential claim deadline is not mislabeled as catalog removal',()=>{
 const v=plusDeadlineOverview({radar:monthly,catalog:base,now:on('2026-11-21')});
 assert.equal(v.claim.kind,'claim');
 assert.equal(v.claim.deadline,'2026-11-30');
 assert.equal(v.claim.daysLeft,9);
 assert.equal(v.claim.games.length,2);
 assert.match(v.claim.games[0].storeUrl,/store\.playstation\.com/);
 assert.equal(v.departures.length,0);
 assert.equal(v.departureCoverage,'unknown');
});
test('after monthly claim end, no countdown or false promise to claim',()=>{
 const v=plusDeadlineOverview({radar:monthly,catalog:base,now:on('2026-12-01')});
 assert.equal(v.claim,null);
 assert.equal(v.departureCoverage,'unknown');
});
test('outdated September Essential data cannot be advertised in November',()=>{
 const v=plusDeadlineOverview({radar:{...monthly,psplusLabel:'SEPTEMBER 2026',psplusText:'Verfügbar bis 30.09.'},catalog:base,now:on('2026-11-21')});
 assert.equal(v.claim,null);
});
test('only explicit, currently supported Extra or Premium leaving dates count',()=>{
 const catalog={...base,games:[
 {id:'concept:1',title:'Verified Extra',services:['extra'],leavingAt:'2026-11-25',playtimeHours:12,storeUrl:'https://store.playstation.com/concept/1'},
 {id:'concept:2',title:'No date',services:['extra']},
 {id:'concept:3',title:'Malformed date',services:['extra'],leavingAt:'2026-02-31'},
 {id:'concept:4',title:'Past departure',services:['premium'],leavingAt:'2026-11-20'},
 {id:'concept:5',title:'Not a catalog removal',services:['essential'],leavingAt:'2026-11-30'}]};
 const v=plusDeadlineOverview({catalog,radar:monthly,now:on('2026-11-21')});
 assert.equal(v.departureCoverage,'confirmed');
 assert.deepEqual(v.departures.map(x=>x.title),['Verified Extra']);
 assert.equal(v.departures[0].daysLeft,4);
 assert.equal(v.departures[0].estimatedHours,12);
});
test('stale or incomplete official catalog is never presented as a confirmed departure schedule',()=>{
 const c={...base,checkedAt:'2026-11-15T10:00:00Z',
 games:[{id:'concept:1',title:'Old entry',services:['extra'],leavingAt:'2026-11-30'}]};
 const a=plusDeadlineOverview({catalog:c,radar:monthly,now:on('2026-11-21')});
 assert.equal(a.sourceFresh,false);
 assert.deepEqual(a.departures,[]);
 const b=plusDeadlineOverview({catalog:{...c,checkedAt:base.checkedAt,sections:{extra:{complete:false}},
 games:[{id:'concept:1',title:'Unconfirmed Extra',services:['extra'],leavingAt:'2026-11-30'}]},radar:monthly,now:on('2026-11-21')});
 assert.deepEqual(b.departures,[]);
});
test('missing playtime cannot be interpreted as enough time to complete a game',()=>{
 const c={...base,games:[{id:'concept:1',title:'Game',services:['extra'],leavingAt:'2026-11-29'}]};
 const v=plusDeadlineOverview({catalog:c,now:on('2026-11-21')});
 assert.equal(v.departures[0].estimatedHours,null);
 assert.equal(v.claim,null);
});
