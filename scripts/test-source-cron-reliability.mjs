import test from 'node:test';
import assert from 'node:assert/strict';
import {
 sourceCronTimeline,sourceCronLabel,watchdogVerdictLabel
} from '../lib/source-cron-reliability.mjs';

const now=new Date('2026-11-21T15:23:00.000Z');
const manual={run_kind:'manual',result:'success',started_at:'2026-11-21T08:00:00.000Z'};
const cron=(result,start)=>({run_kind:'scheduled',result,started_at:start});
const audit=cron('success','2026-11-21T09:57:49.961Z');
const dog={run_day:'2026-11-21',status:'ok',checked_at:'2026-11-21T11:49:51.935Z',push_sent_at:null,push_attempts:0};
const byDay=(report,day)=>report.rows.find(x=>x.day===day);

test('actual 09:57 UTC cron and 11:49 UTC watchdog are both confirmed within the Hobby execution window',()=>{
 const r=sourceCronTimeline([manual,audit],[dog],{now,days:7});
 assert.equal(r.days,7);
 assert.equal(r.anchorDay,'2026-11-21');
 assert.equal(r.rows.length,7);
 const today=byDay(r,'2026-11-21');
 assert.equal(today.status,'success');
 assert.equal(today.timing,'within_window');
 assert.equal(today.starts,1);
 assert.equal(today.hasWatchdogReceipt,true);
 assert.equal(today.watchdog.status,'ok');
 assert.equal(r.summary.withCronReceipt,1);
 assert.equal(r.summary.successful,1);
 assert.equal(r.summary.withWatchdogReceipt,1);
 assert.equal(r.summary.outsideCronWindow,0);
 assert.equal(r.summary.withoutDayEvidence,6);
});
test('failed scheduled job cannot become green merely because any run was recorded',()=>{
 const failed=cron('failed','2026-11-21T09:30:00Z');
 const r=sourceCronTimeline([failed,manual],[{...dog,status:'failed'}],{now,days:7});
 assert.equal(r.rows[0].status,'failed');
 assert.equal(r.summary.failedOrUnfinished,1);
 assert.equal(r.summary.successful,0);
 assert.equal(r.summary.watchdogWarnings,1);
});
test('any genuinely successful scheduled attempt takes precedence over failed retry',()=>{
 const r=sourceCronTimeline([
  cron('failed','2026-11-21T09:05:00Z'),
  cron('success','2026-11-21T09:45:00Z')
 ],[dog],{now,days:7});
 assert.equal(r.rows[0].starts,2);
 assert.equal(r.rows[0].status,'success');
 assert.equal(r.rows[0].timing,'within_window');
});
test('older days with no historical logs are unknown, not failures or successes',()=>{
 const r=sourceCronTimeline([audit],[dog],{now,days:30});
 assert.equal(r.rows.length,30);
 assert.equal(r.summary.withoutDayEvidence,29);
 assert.equal(r.summary.withCronReceipt,1);
 assert.equal(r.summary.noCronProof,0);
 assert.equal(r.summary.successful,1);
 assert.equal(byDay(r,'2026-11-20').status,'unknown');
});
test('a watchdog ok verdict without an actual cron receipt does not prove the job executed',()=>{
 const r=sourceCronTimeline([], [dog],{now,days:7});
 assert.equal(r.rows[0].status,'unconfirmed');
 assert.equal(r.rows[0].watchdog.status,'ok');
 assert.equal(r.summary.successful,0);
 assert.equal(r.summary.noCronProof,1);
});
test('missing cron receipt with watchdog missing is categorized separately from unknown historical days',()=>{
 const r=sourceCronTimeline([],[{...dog,status:'missing',push_sent_at:'2026-11-21T12:00:00Z'}],{now,days:7});
 assert.equal(r.rows[0].status,'missing');
 assert.equal(r.summary.noCronProof,1);
 assert.equal(r.summary.watchdogWarnings,1);
 assert.equal(r.rows[0].watchdog.pushAccepted,true);
});
test('stale running job is unfinished while a recent running job is still running',()=>{
 const old=sourceCronTimeline([cron('running','2026-11-21T09:10:00Z')],[],{now,days:7});
 assert.equal(old.rows[0].status,'unfinished');
 const at=new Date('2026-11-21T09:10:45Z');
 const fresh=sourceCronTimeline([cron('running','2026-11-21T09:10:00Z')],[],{now:at,days:7});
 assert.equal(fresh.rows[0].status,'running');
});
test('before 09 UTC, inside source window, between windows and after watchdog window differ',()=>{
 const at=time=>sourceCronTimeline([],[],{now:new Date('2026-11-21T'+time+'Z'),days:7}).rows[0].status;
 assert.equal(at('08:59:00'),'upcoming');
 assert.equal(at('09:00:00'),'window');
 assert.equal(at('09:59:59'),'window');
 assert.equal(at('10:00:00'),'awaiting_watchdog');
 assert.equal(at('12:14:59'),'awaiting_watchdog');
 assert.equal(at('12:15:00'),'unconfirmed');
});
test('a Cron started at 10 UTC or later is outside the expected 09-10 UTC window',()=>{
 const r=sourceCronTimeline([cron('success','2026-11-21T10:01:00Z')],[dog],{now,days:7});
 assert.equal(r.rows[0].status,'success');
 assert.equal(r.rows[0].timing,'outside_window');
 assert.equal(r.summary.outsideCronWindow,1);
});
test('UTC day boundaries and manual-only records never create a scheduled receipt',()=>{
 const previous=cron('success','2026-11-20T23:59:59.999Z');
 const today=sourceCronTimeline([previous,manual],[],{now,days:7});
 assert.equal(today.rows[0].status,'unconfirmed');
 assert.equal(byDay(today,'2026-11-20').status,'success');
 assert.equal(today.summary.withCronReceipt,1);
});
test('defensive validation rejects unsupported dates, windows and raw shape changes',()=>{
 assert.throws(()=>sourceCronTimeline([],[],{now,days:14}),/Invalid/);
 assert.throws(()=>sourceCronTimeline([],[],{now:new Date('invalid'),days:7}),/Invalid/);
 assert.throws(()=>sourceCronTimeline({},[],{now,days:7}),/Invalid/);
 assert.equal(sourceCronLabel.failed,'Fehlgeschlagen');
 assert.equal(watchdogVerdictLabel.ok,'Bestätigt');
});
