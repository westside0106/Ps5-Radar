// Client-safe daily sample statistics. These are samples, never a continuous uptime SLA.
export const SOURCE_NAMES=Object.freeze({
 psn:'PlayStation Network',igdb:'IGDB / Twitch',rawg:'RAWG',
 steamgriddb:'SteamGridDB',profile:'Supabase · Spielwelt',monitor:'Supabase · PSN-Monitor'
});
export const SOURCE_IDS=Object.freeze(Object.keys(SOURCE_NAMES));
const STATUSES=['healthy','degraded','error','unconfigured'];
const allowedState=state=>STATUSES.includes(state)?state:'unknown';
const isDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'));
const checkedTime=value=>typeof value==='string'&&!Number.isNaN(Date.parse(value))
 ?new Date(value).toISOString():'';
export const qualityStatusLabel=status=>({
 healthy:'Erreichbar',degraded:'Eingeschränkt',error:'Fehler',
 unconfigured:'Nicht eingerichtet',unknown:'Nicht geprüft'
})[allowedState(status)];

export function sourceQualityReport(checks=[],transitions=[],{windowDays=7,anchorDay=new Date().toISOString().slice(0,10)}={}){
 if(![7,30].includes(windowDays)||!isDay(anchorDay))throw Error('Invalid source-quality window');
 const anchor=Date.parse(anchorDay+'T00:00:00Z');
 const days=Array.from({length:windowDays},(_,i)=>new Date(anchor-(windowDays-1-i)*86400000).toISOString().slice(0,10));
 const included=new Set(days);
 const sourceRows=checks.filter(x=>SOURCE_IDS.includes(x?.source_id)&&included.has(x.run_day));
 const sourceTransitions=transitions.filter(x=>SOURCE_IDS.includes(x?.source_id)
  &&(included.has(x.run_day)||included.has(checkedTime(x.checked_at).slice(0,10))));
 const sources=SOURCE_IDS.map(id=>{
  const dayMap=new Map(sourceRows.filter(x=>x.source_id===id).map(x=>[x.run_day,x]));
  const observed=days.map(day=>dayMap.get(day)).filter(Boolean);
  const first={healthy:0,degraded:0,error:0,unconfigured:0,unknown:0};
  const latest={healthy:0,degraded:0,error:0,unconfigured:0,unknown:0};
  for(const row of observed){
   first[allowedState(row.status)]++;
   latest[allowedState(row.latest_status||row.status)]++;
  }
  const last=observed.at(-1)||null;
  return {id,name:SOURCE_NAMES[id],measured:observed.length,unmeasured:windowDays-observed.length,
   first,latest,changedDays:observed.filter(x=>allowedState(x.status)!==allowedState(x.latest_status||x.status)).length,
   transitions:sourceTransitions.filter(x=>x.source_id===id).length,last};
 });
 return {days,windowDays,anchorDay,sources,measuredTotal:sources.reduce((sum,x)=>sum+x.measured,0),
  totalSlots:windowDays*SOURCE_IDS.length};
}
function cleanText(value){
 const str=String(value??'');
 // Untrusted values must never execute spreadsheet formulas when opening CSV.
 return /^[\s]*[=+@\-\t\r]/.test(str)?"'"+str:str;
}
function csvCell(value){
 const str=cleanText(value);
 return '"'+str.replaceAll('"','""')+'"';
}
export function sourceQualityCsv(checks=[],transitions=[],{
 windowDays=7,anchorDay=new Date().toISOString().slice(0,10),sourceId='all'
}={}){
 if(sourceId!=='all'&&!SOURCE_IDS.includes(sourceId))throw Error('Invalid source selection');
 const report=sourceQualityReport(checks,transitions,{windowDays,anchorDay});
 const selected=sourceId==='all'?report.sources:report.sources.filter(x=>x.id===sourceId);
 const rows=[['Datensatz','Quelle','UTC-Tag','Erster Status','Erste Prüfung (UTC)',
  'Letzter Status','Letzte Prüfung (UTC)','Vorheriger Status','Wechsel (UTC)']];
 for(const source of selected){
  const dayMap=new Map(checks.filter(x=>x?.source_id===source.id&&report.days.includes(x.run_day))
    .map(x=>[x.run_day,x]));
  for(const day of report.days){
   const x=dayMap.get(day);
   rows.push(['Tagesbefund',source.name,day,qualityStatusLabel(x?.status),
    checkedTime(x?.checked_at),qualityStatusLabel(x?.latest_status||x?.status),
    checkedTime(x?.latest_checked_at||x?.checked_at),'','']);
  }
 }
 const validTransitions=transitions.filter(x=>(sourceId==='all'?SOURCE_IDS.includes(x?.source_id):x?.source_id===sourceId)
   &&(report.days.includes(x.run_day)||report.days.includes(checkedTime(x.checked_at).slice(0,10))))
  .sort((a,b)=>String(a.checked_at).localeCompare(String(b.checked_at)));
 for(const x of validTransitions){
  rows.push(['Statuswechsel',SOURCE_NAMES[x.source_id],checkedTime(x.checked_at).slice(0,10),
   '','','', '',qualityStatusLabel(x.previous_status)+' → '+qualityStatusLabel(x.status),checkedTime(x.checked_at)]);
 }
 return rows.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
