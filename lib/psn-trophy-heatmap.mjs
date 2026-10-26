// Real trophy unlock timestamps observed when the user opens an individual trophy list.
// These are NOT a complete trophy history until every relevant PSN title has been fetched.
export const TROPHY_DATES_KEY='psn-earned-trophy-dates-v1';
export const TROPHY_DATES_EVENT='psn-earned-trophy-dates-change';
function validISO(value) {
 if(typeof value!=='string'||!value.trim())return null;
 const d=new Date(value);
 return Number.isFinite(d.valueOf())&&d.getTime()>0?d:null;
}
export function dayKey(value,timeZone='Europe/Berlin'){
 const d=validISO(value);
 if(!d)return null;
 try {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return [p.year,p.month,p.day].join('-');
 }catch{return d.toISOString().slice(0,10)}
}
export function normalizeTrophyDates(raw){
 const items=[];
 if(!Array.isArray(raw))return items;
 const seen=new Set();
 for(const row of raw.slice(0,15000)){
  const set=String(row?.set||''),id=String(row?.id||''),date=validISO(row?.at);
  if(!/^[-a-zA-Z0-9_.]{2,100}$/.test(set)||!/^[-a-zA-Z0-9_.]{1,100}$/.test(id)||!date)continue;
  const key=set+'|'+id;if(seen.has(key))continue;seen.add(key);
  items.push({set,id,at:date.toISOString()});
  if(items.length>=7500)break;
 }
 return items;
}
// Combine imported/cloud timestamps without losing local unlocks. Prefer the latest valid
// record for duplicate set+trophy identity, preserving exact Sony timestamps.
export function combineTrophyDates(existing=[],incoming=[]){
 const combined=new Map();
 for(const trophy of [...normalizeTrophyDates(existing),...normalizeTrophyDates(incoming)]){
  const key=trophy.set+'|'+trophy.id;
  combined.set(key,trophy);
 }
 return normalizeTrophyDates([...combined.values()]);
}
export function mergeTrophyDates(existing,setId,trophies){
 const set=String(setId||'');
 if(!/^[-a-zA-Z0-9_.]{2,100}$/.test(set))return normalizeTrophyDates(existing);
 const incoming=Array.isArray(trophies)?trophies:[];
 const observed=[];
 for(const row of incoming){
  if(!row?.earned||!validISO(row.earnedDateTime))continue;
  const id=String(row.trophyId??'');
  if(!/^[-a-zA-Z0-9_.]{1,100}$/.test(id))continue;
  observed.push({set,id,at:new Date(row.earnedDateTime).toISOString()});
 }
 const combined=new Map(normalizeTrophyDates(existing).map(x=>[x.set+'|'+x.id,x]));
 for(const trophy of observed)combined.set(trophy.set+'|'+trophy.id,trophy);
 return normalizeTrophyDates([...combined.values()]);
}
export function trophyHeatmap(entries,{days=364,now=new Date()}={}){
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),12));
 const n=Math.max(7,Math.min(371,Math.floor(days)));
 const counts=new Map();
 for(const item of normalizeTrophyDates(entries)){
  const day=dayKey(item.at);
  if(day)counts.set(day,(counts.get(day)||0)+1);
 }
 const grid=[];
 for(let offset=n-1;offset>=0;offset--){
  const d=new Date(end);d.setUTCDate(d.getUTCDate()-offset);
  const date=d.toISOString().slice(0,10);
  grid.push({date,count:counts.get(date)||0});
 }
 return {grid,total:grid.reduce((s,d)=>s+d.count,0),observed:normalizeTrophyDates(entries).length};
}
