import test from 'node:test';
import assert from 'node:assert/strict';
import {safeEarnedDate,mergeEarnedActivity,recentTrophyDays,TROPHY_ACTIVITY_KEY} from '../lib/psn-trophy-activity.mjs';
test('accept only past real Sony unlock dates and ignore unearned/hidden trophies',()=>{
 const now=new Date('2026-10-26T12:00:00Z');
 assert.equal(safeEarnedDate('2026-10-25T23:10:00Z',now),'2026-10-25');
 assert.equal(safeEarnedDate('not-a-date',now),null);
 assert.equal(safeEarnedDate('2030-01-01T00:00:00Z',now),null);
 const data=mergeEarnedActivity({},'NPWR00123_00',[
  {trophyId:1,earned:true,earnedDateTime:'2026-10-25T16:00:00Z'},
  {trophyId:2,earned:false,earnedDateTime:'2026-10-25T16:00:00Z'},
  {trophyId:3,earned:true,earnedDateTime:null}],now);
 assert.deepEqual(data,{'NPWR00123_00:1':'2026-10-25'});
});
test('re-fetching trophy sets does not double-count unlocks',()=>{
 const now=new Date('2026-10-26T12:00:00Z');
 const t=[{trophyId:1,earned:true,earnedDateTime:'2026-10-25T17:20:00Z'}];
 const once=mergeEarnedActivity({},'NPWR00123_00',t,now);
 const twice=mergeEarnedActivity(once,'NPWR00123_00',t,now);
 assert.deepEqual(twice,once);
 assert.equal(recentTrophyDays(twice,now,14).total,1);
});
test('heatmap summarizes only observed earned trophies in date range',()=>{
 const now=new Date('2026-10-26T12:00:00Z');
 const data={'A:1':'2026-10-25','A:2':'2026-10-25','B:3':'2026-10-20','C:4':'2024-01-01','F:1':'2027-01-01'};
 const summary=recentTrophyDays(data,now,14);
 assert.equal(summary.days.length,14);
 assert.equal(summary.total,3);
 assert.equal(summary.activeDays,2);
 assert.equal(summary.peak.count,2);
 assert.equal(TROPHY_ACTIVITY_KEY,'psn-earned-trophy-events-v1');
});
