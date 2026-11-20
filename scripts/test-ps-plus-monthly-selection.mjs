import test from 'node:test';
import assert from 'node:assert/strict';
import {readMonthlyEdition,monthlyCandidatePriority} from '../lib/ps-plus-monthly-selection.mjs';

const november='https://blog.de.playstation.com/2026/10/28/playstation-plus-monatliche-spiele-fuer-november-dead-island-2-mehr/';
const september='https://blog.de.playstation.com/2026/08/26/playstation-plus-monatliche-spiele-fuer-september-2026/';
const novWindow={start:{year:2026,month:11,day:3},end:{year:2026,month:11,day:30}};
const octWindow={start:{year:2026,month:10,day:6},end:{year:2026,month:11,day:2}};

test('monthly title without printed year uses publication year, never current-month fallback',()=>{
 const e=readMonthlyEdition('PlayStation Plus monatliche Spiele für November: Dead Island 2 & mehr',november);
 assert.deepEqual(e,{month:11,year:2026,label:'NOVEMBER 2026'});
 assert.deepEqual(readMonthlyEdition('PlayStation Plus: Monatliche Spiele für September 2026',september),
  {month:9,year:2026,label:'SEPTEMBER 2026'});
 assert.equal(readMonthlyEdition('PlayStation Plus: Spielekatalog November',november),null);
 assert.equal(readMonthlyEdition('PlayStation Plus: Neue Spiele für Mitglieder',november),null);
 assert.equal(readMonthlyEdition('PlayStation Plus monatliche Spiele für November','https://example.com/2026/10/28/fake/'),null);
});
test('stale September cannot replace November even if the page has parsable games',()=>{
 const today={year:2026,month:11,day:21};
 const old=readMonthlyEdition('PlayStation Plus: Monatliche Spiele für September 2026',september);
 const current=readMonthlyEdition('PlayStation Plus monatliche Spiele für November: Dead Island 2 & mehr',november);
 assert.equal(monthlyCandidatePriority(old,null,today),-1);
 assert.equal(monthlyCandidatePriority(current,novWindow,today),30);
});
test('lineup must be active when a verified availability window is known',()=>{
 const novemberEdition=readMonthlyEdition('PlayStation Plus monatliche Spiele für November: Dead Island 2 & mehr',november);
 const octoberEdition={month:10,year:2026,label:'OKTOBER 2026'};
 assert.equal(monthlyCandidatePriority(novemberEdition,novWindow,{year:2026,month:11,day:1}),-1);
 assert.equal(monthlyCandidatePriority(octoberEdition,octWindow,{year:2026,month:11,day:1}),10);
 assert.equal(monthlyCandidatePriority(novemberEdition,novWindow,{year:2026,month:11,day:3}),30);
 assert.equal(monthlyCandidatePriority(novemberEdition,novWindow,{year:2026,month:12,day:1}),-1);
});
test('publication year rollover is explicit and does not invent another edition',()=>{
 const u='https://blog.de.playstation.com/2026/12/20/playstation-plus-monatliche-spiele-fuer-januar/';
 assert.deepEqual(readMonthlyEdition('PlayStation Plus monatliche Spiele für Januar',u),
  {month:1,year:2027,label:'JANUAR 2027'});
 assert.equal(monthlyCandidatePriority({month:12,year:2026},{start:{year:2026,month:12,day:1},end:{year:2027,month:1,day:6}},{year:2027,month:1,day:3}),10);
});
