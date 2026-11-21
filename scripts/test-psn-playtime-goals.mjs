import test from 'node:test';
import assert from 'node:assert/strict';
import {
 buildPlaytimeGoalInsights,normalizeTimeGoalHours,normalizeTimeGoalType,normalizedPlaytimeTitle
} from '../lib/psn-playtime-goals.mjs';

const game=(key,name,playDuration,metadata={})=>({key,name,game:{titleId:key,name,playDuration,...metadata}});
const session=(game,start,end,extra={})=>({game,start,end,timeZone:'Etc/UTC',...extra});

test('time targets are explicit, bounded, and cannot be smuggled through malformed strings',()=>{
 for(const [value,expected] of [['0.5',0.5],['40',40],['40,5',40.5],[1000,1000],[0.5,0.5],['',null],[null,null],[undefined,null],['1000.5',null],['0',null],[-1,null],[Infinity,null],['4.25',null],['1e3',null],['00.1',null],['abc',null],[{},null]]){
  assert.equal(normalizeTimeGoalHours(value),expected,String(value));
 }
 assert.equal(normalizeTimeGoalType('story'),'story');
 assert.equal(normalizeTimeGoalType('platinum'),'platinum');
 assert.equal(normalizeTimeGoalType('malicious'),'personal');
});

test('PSN cumulative values, observed sessions and user goals remain independent',()=>{
 const games=[game('A','Grand Theft Auto VI (PS5)','PT25H')];
 const notes={A:{timeGoalHours:40,timeGoalType:'story',status:'playing'}};
 const obs=[session('Grand Theft Auto VI','2026-11-20T12:00:00.000Z','2026-11-20T13:00:00.000Z')];
 const result=buildPlaytimeGoalInsights(games,notes,obs);
 assert.equal(result.goalCount,1);
 assert.equal(result.comparable,1);
 assert.equal(result.observedGames,1);
 assert.equal(result.observedSessions,1);
 assert.equal(result.rows[0].psnMinutes,1500);
 assert.equal(result.rows[0].observedMinutes,60);
 assert.equal(result.rows[0].progressPct,63);
 assert.equal(result.rows[0].distanceMinutes,900);
 assert.equal(result.rows[0].goalKind,'story');
 assert.equal(result.rows[0].observationMatch,'exact-title');
 assert.notEqual(result.rows[0].psnMinutes,1560,'must never add observed data to Sony values');
 assert.deepEqual(result.unmatchedObservations,[]);
});

test('no PSN playtime means unknown progress rather than zero playtime or fake completion',()=>{
 const result=buildPlaytimeGoalInsights([game('X','Never played',null)],{X:{timeGoalHours:10}},[]);
 assert.equal(result.rows[0].psnMinutes,null);
 assert.equal(result.rows[0].progressPct,null);
 assert.equal(result.rows[0].distanceMinutes,null);
 assert.equal(result.comparable,0);
});

test('PSN time beyond target caps percentage but does not infer game completion',()=>{
 const result=buildPlaytimeGoalInsights([game('G','Long RPG','PT90H')],{G:{timeGoalHours:20,timeGoalType:'platinum'}});
 assert.equal(result.rows[0].progressPct,100);
 assert.equal(result.rows[0].distanceMinutes,0);
 assert.equal(result.rows[0].status,'');
});

test('exact titles may ignore PS5 suffix but never conflate two Sony platform editions',()=>{
 const names=['GTA VI (PS5)','GTA VI (PS4)'].map(normalizedPlaytimeTitle);
 assert.equal(names[0],names[1]);
 const result=buildPlaytimeGoalInsights(
  [game('PS5','GTA VI (PS5)','PT4H'),game('PS4','GTA VI (PS4)','PT9H')],{},
  [session('GTA VI','2026-11-20T12:00:00.000Z','2026-11-20T12:30:00.000Z')]
 );
 assert.equal(result.rows.every(x=>x.observedSessions===0),true);
 assert.equal(result.unmatchedObservations.length,1);
 assert.equal(result.unmatchedObservations[0].reason,'Mehrdeutiger Titel');
 assert.equal(result.unmatchedObservations[0].minutes,30);
});

test('nonmatching game versions remain unmapped, not silently merged by substring',()=>{
 const result=buildPlaytimeGoalInsights([game('L','The Last of Us Part I','PT9H')],{},
  [session('The Last of Us Part II','2026-11-20T12:00:00.000Z','2026-11-20T13:00:00.000Z')]);
 assert.equal(result.rows[0].observedSessions,0);
 assert.equal(result.unmatchedObservations[0].reason,'Keine exakte Zuordnung');
});

test('observed sessions are revalidated, de-duplicated and bounded before analysis',()=>{
 const duplicate=session('Cyberpunk 2077','2026-11-20T12:00:00.000Z','2026-11-20T13:00:00.000Z',{minutes:9999});
 const malformed=session('Cyberpunk 2077','2026-11-20T13:00:00.000Z','2026-11-20T12:00:00.000Z');
 const result=buildPlaytimeGoalInsights([game('C','Cyberpunk 2077','PT5H')],{},[duplicate,duplicate,malformed]);
 assert.equal(result.observedSessions,1);
 assert.equal(result.rows[0].observedSessions,1);
 assert.equal(result.rows[0].observedMinutes,60);
 assert.equal(result.observedTotalMinutes,60);
});

test('manual community platinum estimate is displayed independently, not a user target',()=>{
 const result=buildPlaytimeGoalInsights([game('A','Assassin’s Creed Shadows','PT70H',{communityInsight:{platinumHours:95}})]);
 assert.equal(result.rows[0].communityPlatinumHours,95);
 assert.equal(result.rows[0].goalHours,null);
 assert.equal(result.rows[0].progressPct,null);
 assert.equal(result.goalCount,0);
});

test('duplicate IDs are counted once and notes do not create unowned games',()=>{
 const games=[game('P','P1','PT10H'),game('P','P1','PT10H')];
 const result=buildPlaytimeGoalInsights(games,{P:{timeGoalHours:12},Q:{timeGoalHours:3}});
 assert.equal(result.rows.length,1);
 assert.equal(result.goalCount,1);
});

test('empty or old style notes and invalid community estimates remain compatible',()=>{
 const result=buildPlaytimeGoalInsights([game('old','Classic','PT1H',{communityInsight:{platinumHours:'unknown'}})],{old:{status:'planned',note:'hi'}});
 assert.equal(result.rows[0].goalHours,null);
 assert.equal(result.rows[0].communityPlatinumHours,null);
 assert.equal(result.rows[0].progressPct,null);
});
