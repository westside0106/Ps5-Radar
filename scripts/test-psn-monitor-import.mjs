import test from 'node:test';
import assert from 'node:assert/strict';
import {PSN_MONITOR_KEY,MAX_MONITOR_CSV_BYTES,parseMonitorCsvRows,parsePsnMonitorCsv,resolveMonitorWallTime,validMonitorZone,normalizeObservedSessions,mergeObservedSessions} from '../lib/psn-monitor-import.mjs';
import {validCloudPayload} from '../lib/psn-cloud-helpers.mjs';

const at=new Date('2026-11-22T12:00:00Z');
const csv=rows=>'"Date","Status","Game name"\r\n'+rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
const sample=[
 ['2026-11-20 10:00:00','online','Cyberpunk 2077'],
 ['2026-11-20 11:00:00','online','Hitman World of Assassination'],
 ['2026-11-20 12:15:00','offline','']
];

test('upstream CSV shape and escaped titles with commas or quotations survive parsing',()=>{
 const raw=csv([['2026-11-20 09:00:00','online','A, "Special" Edition'],['2026-11-20 10:00:00','offline','']]);
 const rows=parseMonitorCsvRows('\ufeff'+raw);
 assert.deepEqual(rows[0],['2026-11-20 09:00:00','online','A, "Special" Edition']);
 assert.equal(rows.length,2);
 assert.throws(()=>parseMonitorCsvRows('When,Game\n1,X'),/Date, Status, Game name/);
 assert.throws(()=>parseMonitorCsvRows('x'.repeat(MAX_MONITOR_CSV_BYTES+1)),/2 MB/);
 assert.throws(()=>parseMonitorCsvRows('"Date","Status","Game name"\n"2026-11-20,online,abc'),/geschlossen/);
});
test('monitored game switches and offline events create observed, bounded intervals',()=>{
 const p=parsePsnMonitorCsv(csv(sample),{timeZone:'UTC',now:at});
 assert.equal(p.sessions.length,2);assert.equal(p.rows,3);assert.equal(p.recognized,3);
 assert.deepEqual(p.sessions.map(s=>[s.game,s.minutes,s.stopReason]),[
  ['Cyberpunk 2077',60,'game-switch'],['Hitman World of Assassination',75,'offline']]);
 assert.equal(p.totalMinutes,135);
 assert.equal(p.sessions[0].start,'2026-11-20T10:00:00.000Z');
 assert.equal(p.sessions[0].end,'2026-11-20T11:00:00.000Z');
 assert.equal(p.sessions[0].source,'psn_monitor CSV');
 assert.equal(PSN_MONITOR_KEY,'psn-observed-game-sessions-v1');
});
test('timezone is explicitly required: UTC and Europe/Berlin produce different instants',()=>{
 assert.equal(validMonitorZone('Europe/Berlin'),true);
 assert.equal(validMonitorZone('https://evil.test'),false);
 assert.throws(()=>parsePsnMonitorCsv(csv(sample),{now:at}),/Zeitzone/);
 const utc=resolveMonitorWallTime('2026-11-20 10:00:00','UTC');
 const berlin=resolveMonitorWallTime('2026-11-20 10:00:00','Europe/Berlin');
 assert.equal(utc.at,'2026-11-20T10:00:00.000Z');
 assert.equal(berlin.at,'2026-11-20T09:00:00.000Z');
});
test('DST spring gap and autumn duplicate hour cannot create fake durations',()=>{
 assert.equal(resolveMonitorWallTime('2026-03-29 02:30:00','Europe/Berlin').status,'nonexistent-time');
 assert.equal(resolveMonitorWallTime('2026-10-25 02:30:00','Europe/Berlin').status,'ambiguous-time');
 const raw=csv([
  ['2026-10-25 01:30:00','online','Alpha'],
  ['2026-10-25 02:30:00','online','Beta'],
  ['2026-10-25 03:30:00','offline','']
 ]);
 const p=parsePsnMonitorCsv(raw,{timeZone:'Europe/Berlin',now:at});
 assert.equal(p.warningCounts.ambiguous,1);
 assert.equal(p.sessions.length,0,'must not bridge a DST ambiguous timestamp');
});
test('spring nonexistent local time is detected even in apparently chronological CSV',()=>{
 const p=parsePsnMonitorCsv(csv([
  ['2026-03-29 01:30:00','online','Alpha'],
  ['2026-03-29 02:30:00','online','Beta'],
  ['2026-03-29 03:30:00','offline','']
 ]),{timeZone:'Europe/Berlin',now:at});
 assert.equal(p.warningCounts.nonexistent,1);
 assert.equal(p.sessions.length,0);
});
test('long gaps, truncated logging and reversed times never invent sessions',()=>{
 const p=parsePsnMonitorCsv(csv([
  ['2026-11-19 09:00:00','online','Long Game'],
  ['2026-11-20 09:01:00','offline',''],
  ['2026-11-20 12:00:00','online','Unfinished Game']
 ]),{timeZone:'UTC',now:at});
 assert.equal(p.sessions.length,0);assert.equal(p.warningCounts.longGaps,1);
 assert.equal(p.warningCounts.incomplete,1);
 const q=parsePsnMonitorCsv(csv([
  ['2026-11-20 10:00:00','online','Alpha'],
  ['2026-11-20 09:00:00','offline',''],
  ['2026-11-20 12:00:00','offline','']
 ]),{timeZone:'UTC',now:at});
 assert.equal(q.warningCounts.outOfOrder,1);
 assert.equal(q.sessions.length,0);
});
test('identical rows are deduplicated; media and arbitrary statuses cannot inflate durations',()=>{
 const p=parsePsnMonitorCsv(csv([
  ['2026-11-20 10:00:00','online','Alpha'],
  ['2026-11-20 10:00:00','online','Alpha'],
  ['2026-11-20 10:10:00','offline',''],
  ['2026-11-20 11:00:00','weird','Not a game'],
  ['2026-11-20 11:10:00','online','Alpha'],
  ['2026-11-20 11:20:00','offline','']
 ]),{timeZone:'UTC',now:at});
 assert.equal(p.sessions.length,2);assert.equal(p.totalMinutes,20);
 assert.equal(p.warningCounts.duplicates,1);assert.equal(p.warningCounts.unknownStatus,1);
});
test('merging repeated imports is idempotent and never trusts forged data or durations',()=>{
 const items=parsePsnMonitorCsv(csv(sample),{timeZone:'UTC',now:at}).sessions;
 assert.deepEqual(mergeObservedSessions(items,items),items);
 const tampered={...items[0],minutes:1_000_000,source:'fake',quality:'exact'};
 const clean=normalizeObservedSessions([tampered]);
 assert.equal(clean[0].minutes,60);
 assert.equal(clean[0].source,'psn_monitor CSV');
 assert.equal(clean[0].quality,'poll-observed');
 assert.equal(normalizeObservedSessions([{...items[0],end:'broken'}]).length,0);
});
test('existing cloud schema accepts optional monitored arrays but rejects objects',()=>{
 assert.equal(validCloudPayload({notes:{},observedSessions:[]}),true);
 assert.equal(validCloudPayload({observedSessions:{arbitrary:'invalid'}}),false);
});
