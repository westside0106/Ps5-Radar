import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPricePoints,summarizePriceHistory,chartPoints} from '../lib/price-radar-insights.mjs';
import {calendarIcs} from '../lib/radar-calendar-export.mjs';
import {TROPHY_DATES_KEY,mergeTrophyDates,normalizeTrophyDates,trophyHeatmap} from '../lib/psn-trophy-heatmap.mjs';

test('historical Radar prices are sorted by date and never treated as live merchant quotes',()=>{
 const history=[{date:'2026-10-02',price:18.99},{date:'2026-10-01',price:28.99},{date:'2026-10-02',price:17.99},{date:'2026-10-04',price:-9},{date:'2026-10-07',price:19.99}];
 assert.equal(cleanPricePoints(history).length,3);
 const x=summarizePriceHistory(history);
 assert.equal(x.first.price,28.99);
 assert.equal(x.last.price,19.99);
 assert.equal(x.low,17.99);
 assert.ok(x.change<0);
 assert.equal(chartPoints([{date:'2026-10-01',price:5}]),'');
 assert.ok(chartPoints(history).includes(','));
});

test('calendar export uses backed source dates, avoids duplicates and escapes text',()=>{
 const events=[
  {date:'2026-10-26',title:'GTA 6, Sale; Alert',type:'release',subtitle:'Bestätigt, nicht live geprüft'},
  {date:'2026-10-26',title:'GTA 6, Sale; Alert',type:'release',subtitle:'Duplikat'},
  {date:'invalid',title:'Fake',type:'release'},
 ];
 const ics=calendarIcs(events,new Date('2026-10-26T10:10:10Z'));
 assert.match(ics,/BEGIN:VCALENDAR\r\nVERSION:2.0/);
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
 assert.match(ics,/DTSTART;VALUE=DATE:20261026/);
 assert.match(ics,/DTEND;VALUE=DATE:20261027/);
 assert.ok(ics.includes('GTA 6\\, Sale\\; Alert'));
 assert.ok(!ics.includes('SUMMARY:Fake'));
});

test('PSN trophy dates only persist truly unlocked timestamps and deduplicate repeated list fetches',()=>{
 assert.equal(TROPHY_DATES_KEY,'psn-earned-trophy-dates-v1');
 const incoming=[{trophyId:0,earned:true,earnedDateTime:'2026-10-25T23:30:00Z'},{trophyId:1,earned:false,earnedDateTime:'2026-10-25T10:00:00Z'},{trophyId:2,earned:true},{trophyId:3,earned:true,earnedDateTime:'2026-10-26T09:00:00Z'}];
 const entries=mergeTrophyDates([], 'NPWR00001_00',incoming);
 assert.equal(entries.length,2);
 assert.equal(mergeTrophyDates(entries,'NPWR00001_00',incoming).length,2);
 assert.equal(normalizeTrophyDates([{set:'oops',id:'A',at:'bad'}]).length,0);
 const heat=trophyHeatmap(entries,{days:7,now:new Date('2026-10-27T00:00:00Z')});
 assert.equal(heat.observed,2);
 assert.equal(heat.total,2);
 assert.ok(heat.grid.some(x=>x.date==='2026-10-26'&&x.count===2),'Berlin local date should include 25 Oct at 23:30Z');
});
