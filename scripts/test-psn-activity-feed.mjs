import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPersonalActivityFeed} from '../lib/psn-activity-feed.mjs';

const at=new Date('2026-11-22T12:00:00Z');
const titles=[
 {npCommunicationId:'NPWR10001_00',trophyTitleName:'Cyberpunk 2077'},
 {npCommunicationId:'NPWR10002_00',trophyTitleName:'Hitman World of Assassination'}
];

test('trophy events use cached Sony timestamps, grouped only by local day and PSN set',()=>{
 const input=[
  {set:'NPWR10001_00',id:'1',at:'2026-11-20T23:55:00Z'}, // Berlin: Nov 21
  {set:'NPWR10001_00',id:'2',at:'2026-11-21T00:05:00Z'},
  {set:'NPWR10002_00',id:'1',at:'2026-11-21T14:30:00Z'},
  {set:'NPWR10001_00',id:'2',at:'2026-11-21T00:05:00Z'} // duplicate
 ];
 const feed=buildPersonalActivityFeed({trophyDates:input,titles,now:at});
 assert.equal(feed.trophyUnlocks,3);
 assert.equal(feed.trophyEvents,2);
 assert.equal(feed.knownTrophySets,2);
 assert.equal(feed.knownLastPlayed,0);
 const cyberpunk=feed.events.find(x=>x.setId==='NPWR10001_00');
 assert.equal(cyberpunk.count,2);
 assert.equal(cyberpunk.day,'2026-11-21');
 assert.equal(cyberpunk.at,'2026-11-21T00:05:00.000Z');
 assert.equal(cyberpunk.title,'Cyberpunk 2077');
 assert.equal(feed.coverage,'partial');
});
test('game events are unique per title ID and remain last-played, not completed sessions',()=>{
 const feed=buildPersonalActivityFeed({now:at,played:[
  {titleId:'PSA',name:'Alpha',lastPlayedDateTime:'2026-11-20T10:00:00Z'},
  {titleId:'PSA',name:'Alpha',lastPlayedDateTime:'2026-11-21T10:00:00Z'},
  {titleId:'PSB',name:'Bravo',lastPlayedDateTime:'2026-11-21T17:00:00Z'},
  {titleId:'PSC',name:'YouTube',lastPlayedDateTime:'2026-11-21T21:00:00Z'},
  {titleId:'PSD',name:'No date',lastPlayedDateTime:''},
 ]});
 assert.equal(feed.knownLastPlayed,2);
 assert.equal(feed.totalEvents,2);
 assert.deepEqual(feed.events.map(x=>x.title),['Bravo','Alpha']);
 assert.equal(feed.events[0].kind,'last-played');
 assert.equal(feed.events[0].source,'psn-last-played');
 assert.equal(feed.trophyUnlocks,0);
});
test('invalid or future game and trophy events do not fabricate history',()=>{
 const feed=buildPersonalActivityFeed({now:at,trophyDates:[
  {set:'NPWR10001_00',id:'2',at:'broken'},
  {set:'NPWR10001_00',id:'3',at:'2027-11-21T09:00:00Z'}
 ],played:[
  {titleId:'a',name:'Invalid',lastPlayedDateTime:'not a date'},
  {titleId:'b',name:'Future',lastPlayedDateTime:'2027-12-11T09:00:00Z'}
 ]});
 assert.equal(feed.totalEvents,0);
 assert.equal(feed.trophyUnlocks,0);
 assert.equal(feed.activeDates,0);
 assert.deepEqual(feed.events,[]);
});
test('records without matching trophy-list metadata are labeled as unknown list, not invented game',()=>{
 const feed=buildPersonalActivityFeed({now:at,trophyDates:[{set:'NPWR99999_00',id:'34',at:'2026-11-21T00:00:00Z'}]});
 assert.match(feed.events[0].title,/NPWR99999_00/);
 assert.equal(feed.knownTrophySets,1);
});
test('limit caps visible records without changing analytics or source metadata',()=>{
 const played=Array.from({length:4},(_,i)=>({titleId:'id'+i,name:'Game '+i,lastPlayedDateTime:'2026-11-21T1'+i+':00:00Z'}));
 const feed=buildPersonalActivityFeed({played,now:at,limit:2});
 assert.equal(feed.totalEvents,4);
 assert.equal(feed.knownLastPlayed,4);
 assert.equal(feed.events.length,2);
 assert.equal(feed.activeDates,1);
 assert.ok(feed.events.every(x=>x.source==='psn-last-played'));
});
