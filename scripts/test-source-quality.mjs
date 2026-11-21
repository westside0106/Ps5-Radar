import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceQualityReport,sourceQualityCsv,qualityStatusLabel,SOURCE_IDS} from '../lib/source-quality.mjs';

const anchorDay='2026-11-21';
const igdb={
 source_id:'igdb',run_day:anchorDay,status:'error',
 checked_at:'2026-11-21T03:34:00.999Z',latest_status:'healthy',
 latest_checked_at:'2026-11-21T03:56:00Z',detail:'=HYPERLINK("bad")',
 latest_detail:'access_token=must-never-export'
};
const rawg={source_id:'rawg',run_day:'2026-11-20',status:'healthy',checked_at:'2026-11-20T12:00:00Z'};
const transition={source_id:'igdb',run_day:anchorDay,previous_status:'error',status:'healthy',
 checked_at:'2026-11-21T03:56:00Z',previous_checked_at:'2026-11-21T03:34:00.999Z',
 detail:'secret-private-token'};
test('7-day results explicitly separate sampled and unsampled days for every provider',()=>{
 const q=sourceQualityReport([igdb,rawg],[transition],{windowDays:7,anchorDay});
 assert.equal(q.days.length,7);
 assert.equal(q.days[0],'2026-11-15');
 assert.equal(q.days.at(-1),anchorDay);
 assert.equal(q.sources.length,6);
 const ig=q.sources.find(s=>s.id==='igdb');
 assert.equal(ig.measured,1);
 assert.equal(ig.unmeasured,6);
 assert.equal(ig.first.healthy,0);
 assert.equal(ig.first.error,1);
 assert.equal(ig.latest.healthy,1);
 assert.equal(ig.changedDays,1);
 assert.equal(ig.transitions,1);
 const psn=q.sources.find(s=>s.id==='psn');
 assert.equal(psn.measured,0);
 assert.equal(psn.unmeasured,7);
 assert.equal(q.measuredTotal,2);
 assert.equal(q.totalSlots,42);
});
test('30-day window does not fabricate history or interpret unchecked days as provider failures',()=>{
 const q=sourceQualityReport([igdb,rawg],[transition],{windowDays:30,anchorDay});
 assert.equal(q.days.length,30);
 assert.equal(q.sources.find(s=>s.id==='igdb').unmeasured,29);
 assert.equal(q.sources.find(s=>s.id==='rawg').first.healthy,1);
 assert.equal(q.sources.find(s=>s.id==='psn').first.error,0);
 assert.equal(q.measuredTotal,2);
 assert.equal(q.totalSlots,180);
});
test('UTC day boundaries and truly missing data are not blurred by local time',()=>{
 const d=sourceQualityReport([{
  source_id:'monitor',run_day:'2026-11-20',status:'degraded',checked_at:'2026-11-20T23:59:59.999Z'
 },{
  source_id:'monitor',run_day:'2026-11-21',status:'healthy',checked_at:'2026-11-21T00:00:00.100Z'
 }],[],{windowDays:7,anchorDay});
 assert.equal(d.sources.find(s=>s.id==='monitor').measured,2);
 assert.equal(d.sources.find(s=>s.id==='monitor').unmeasured,5);
});
test('CSV explicitly lists missing days and includes all six provider sources',()=>{
 const csv=sourceQualityCsv([igdb,rawg],[transition],{windowDays:7,anchorDay});
 const lines=csv.trim().split('\r\n');
 assert.equal(lines.length,44,'header + 42 daily rows + one transition row');
 assert.ok(lines[0].includes('UTC-Tag'));
 assert.ok(csv.includes('Nicht geprüft'));
 assert.ok(csv.includes('Statuswechsel'));
 assert.ok(csv.includes('IGDB / Twitch'));
 assert.ok(csv.includes('Fehler → Erreichbar'));
 assert.ok(csv.includes('2026-11-21T03:56:00.000Z'));
 assert.ok(!csv.includes('access_token=must-never-export'));
 assert.ok(!csv.includes('secret-private-token'));
 assert.ok(!csv.includes('HYPERLINK'));
});
test('CSV source filter is deterministic and never exports unrelated provider rows',()=>{
 const csv=sourceQualityCsv([igdb,rawg],[transition],{windowDays:7,anchorDay,sourceId:'igdb'});
 const lines=csv.trim().split('\r\n');
 assert.equal(lines.length,9,'header + seven IGDB dates + transition');
 assert.ok(!csv.includes('RAWG'));
 assert.ok(csv.includes('IGDB / Twitch'));
 assert.throws(()=>sourceQualityCsv([],[],{sourceId:'__proto__',anchorDay}),/Invalid source selection/);
});
test('CSV never interpolates arbitrary provider IDs or formula-like detail fields',()=>{
 const csv=sourceQualityCsv([
  {...igdb,source_id:'=HYPERLINK("http://bad")'},
  igdb,
  {...rawg,source_id:'extraneous'}
 ],[{...transition,source_id:'unknown'},transition],{windowDays:7,anchorDay});
 assert.equal(csv.includes('=HYPERLINK'),false);
 assert.equal(csv.includes('must-never-export'),false);
 assert.equal(csv.match(/Statuswechsel/g)?.length,2);
});
test('quality calculations validate periods without mutating input',()=>{
 const data=[rawg,igdb];
 const snapshot=JSON.stringify(data);
 assert.throws(()=>sourceQualityReport(data,[],{windowDays:31,anchorDay}),/Invalid/);
 assert.throws(()=>sourceQualityReport(data,[],{windowDays:7,anchorDay:'bad'}),/Invalid/);
 assert.equal(qualityStatusLabel('healthy'),'Erreichbar');
 assert.equal(qualityStatusLabel('weird'),'Nicht geprüft');
 assert.equal(SOURCE_IDS.length,6);
 sourceQualityReport(data,[],{windowDays:7,anchorDay});
 assert.equal(JSON.stringify(data),snapshot);
});
