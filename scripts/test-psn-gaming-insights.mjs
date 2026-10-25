import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSnapshotHistory,snapshotPairs,snapshotMonths,lastPlayedEvents,platinumProjects} from '../lib/psn-gaming-insights.mjs';
import {trophySetCandidates} from '../lib/psn-platinum-plan.mjs';

test('historical local cumulative snapshots are normalized, sorted and de-duplicated',()=>{
 const raw=[
  {date:'2026-10-03',minutes:540,games:4},
  {date:'2026-10-01',minutes:120,games:4},
  {date:'2026-10-03',minutes:600,games:4},
  {date:'garbage',minutes:10,games:4},
  {date:'2026-10-02',minutes:450,games:5},
  {date:'2026-10-04',minutes:650,games:4},
  {date:'2026-10-05',minutes:500,games:4}
 ];
 const history=normalizeSnapshotHistory(raw);
 assert.equal(history.length,5);
 assert.equal(history[2].minutes,600);
 assert.deepEqual(history.map(r=>r.date),['2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05']);
 const pairs=snapshotPairs(raw);
 assert.equal(pairs.length,4);
 assert.equal(pairs[0].comparable,false,'changed PSN game count cannot imply playtime');
 assert.equal(pairs[1].comparable,false);
 assert.equal(pairs[2].minutes,50,'only non-negative diffs with equal game counts are potentially comparable');
 assert.equal(pairs[3].comparable,false,'decreases are not counted as playtime');
 const [month]=snapshotMonths(raw,3);
 assert.equal(month.month,'2026-10');
 assert.equal(month.indicativeMinutes,50);
 assert.equal(month.uncertainPairs,3);
});
test('monthly counts do not invent sessions and only include observed snapshot months',()=>{
 const m=snapshotMonths([{date:'2026-09-27',minutes:120,games:3},{date:'2026-10-02',minutes:240,games:3},{date:'2026-10-03',minutes:300,games:3}],6);
 assert.deepEqual(m.map(x=>x.month),['2026-09','2026-10']);
 assert.equal(m[0].indicativeMinutes,0);
 assert.equal(m[1].indicativeMinutes,180);
 assert.equal(m[1].validPairs,2);
 assert.equal(m[1].readings,2);
});
test('chronology contains only last-known title activity, not fabricated sessions',()=>{
 const list=lastPlayedEvents([
  {titleId:'b',name:'B',lastPlayedDateTime:'2026-10-25T11:00:00Z'},
  {titleId:'a',name:'A',lastPlayedDateTime:'2026-10-26T11:00:00Z'},
  {titleId:'bad',name:'Unknown'},
  {titleId:'c',name:'C',lastPlayedDateTime:'not a date'}],10);
 assert.deepEqual(list.map(x=>x.title),['A','B']);
 assert.equal(list[0].kind,'psn-last-played');
 assert.equal(list[0].dateKey,'2026-10-26');
});
test('platinum projects require explicit personal status and Sony-confirmed trophy unlock',()=>{
 const games=[{titleId:'PPSA00200',name:'Shadow Game'},{titleId:'PPSA00300',name:'Many Editions'},{titleId:'PPSA00400',name:'Not a Project'}];
 const titles=[
  {npCommunicationId:'NPWR00001_00',trophyTitleName:'Shadow Game',progress:100,earnedTrophies:{platinum:0}},
  {npCommunicationId:'NPWR00002_00',trophyTitleName:'Many Editions (PS4)',progress:30,earnedTrophies:{platinum:0}},
  {npCommunicationId:'NPWR00003_00',trophyTitleName:'Many Editions (PS5)',progress:95,earnedTrophies:{platinum:1}}
 ];
 const notes={
  PPSA00200:{status:'platinum',priority:'high'},
  PPSA00300:{status:'platinum',priority:'normal'},
  PPSA00400:{status:'planned'}
 };
 const projects=platinumProjects(games,titles,notes,trophySetCandidates);
 assert.equal(projects.length,2);
 assert.equal(projects[0].progress,100);
 assert.equal(projects[0].platinumEarned,false,'100% trophy progress never proves a platinum trophy');
 assert.equal(projects[1].candidates,2);
 assert.equal(projects[1].trophy,null,'ambiguous editions must not be silently mixed');
 const chosen=platinumProjects(games,titles,{...notes,PPSA00300:{status:'platinum',trophySetId:'NPWR00003_00'}},trophySetCandidates);
 assert.equal(chosen.find(p=>p.id==='PPSA00300').platinumEarned,true);
});
