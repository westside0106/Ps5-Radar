// Read-only, provenance-aware presentation helpers for PSN data and local snapshots.
// A lastPlayedDateTime is one last-known activity date, never a play session.
export function validDate(value){
 if(typeof value!=='string'||!value.trim())return null;
 const d=new Date(value);
 return Number.isFinite(d.getTime())?d:null;
}
export function localDateKey(value){
 const d=validDate(value);
 if(!d)return '';
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
const validReading=r=>r&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&validDate(r.date+'T12:00:00')&&Number.isFinite(r.minutes)&&r.minutes>=0&&Number.isInteger(r.games)&&r.games>=0;
export function normalizeSnapshotHistory(value){
 if(!Array.isArray(value))return [];
 const days=new Map();
 for(const item of value){
  if(!validReading(item))continue;
  days.set(item.date,{date:item.date,minutes:Math.round(item.minutes),games:item.games});
 }
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-365);
}
export function snapshotPairs(input){
 const records=normalizeSnapshotHistory(input),result=[];
 for(let i=1;i<records.length;i++){
  const prev=records[i-1],next=records[i];
  const delta=next.minutes-prev.minutes;
  // The game count alone cannot prove identical titles; never call these hours played.
  const comparable=prev.games===next.games&&delta>=0;
  result.push({date:next.date,minutes:comparable?delta:null,comparable,reason:!comparable?'Geänderte Titelzahl oder rückläufiger Gesamtwert':null,previousDate:prev.date});
 }
 return result;
}
export function snapshotMonths(history,limit=6){
 const points=normalizeSnapshotHistory(history),pairs=snapshotPairs(points);
 const byMonth=new Map();
 for(const p of points){
  const key=p.date.slice(0,7);
  if(!byMonth.has(key))byMonth.set(key,{month:key,readings:0,indicativeMinutes:0,validPairs:0,uncertainPairs:0,latestTotal:0});
  const row=byMonth.get(key);
  row.readings++;row.latestTotal=p.minutes;
 }
 for(const p of pairs){
  const row=byMonth.get(p.date.slice(0,7));
  if(!row)continue;
  if(p.comparable){row.indicativeMinutes+=p.minutes;row.validPairs++}
  else row.uncertainPairs++;
 }
 return [...byMonth.values()].sort((a,b)=>a.month.localeCompare(b.month)).slice(-Math.max(1,Math.min(12,limit)));
}
export function lastPlayedEvents(games=[],limit=30){
 return (Array.isArray(games)?games:[]).filter(g=>validDate(g.lastPlayedDateTime))
  .map(g=>({id:String(g.titleId||g.name||g.titleName||''),title:String(g.name||g.titleName||'Spiel'),date:g.lastPlayedDateTime,dateKey:localDateKey(g.lastPlayedDateTime),timestamp:validDate(g.lastPlayedDateTime).getTime(),kind:'psn-last-played'}))
  .filter(e=>e.id).sort((a,b)=>b.timestamp-a.timestamp||a.title.localeCompare(b.title,'de')).slice(0,Math.min(100,limit));
}
export function platinumProjects(played=[],titles=[],notes={},match){
 const result=[];
 for(const game of Array.isArray(played)?played:[]){
  const id=String(game.titleId||game.name||game.titleName||'');
  const info=notes?.[id]||{};
  if(info.status!=='platinum')continue;
  const matches=match(game,titles);
  const preferred=String(info.trophySetId||'');
  const trophy=matches.find(t=>String(t.npCommunicationId)===preferred)||(matches.length===1?matches[0]:null);
  const progress=trophy&&Number.isFinite(Number(trophy.progress))?Math.max(0,Math.min(100,Number(trophy.progress))):null;
  result.push({id,title:String(game.name||game.titleName||'Spiel'),priority:info.priority||'normal',note:String(info.note||''),lastSaved:info.updatedAt||'',trophy,progress,candidates:matches.length,platinumEarned:Boolean(trophy&&Number(trophy.earnedTrophies?.platinum)>0)});
 }
 return result.sort((a,b)=>Number(b.priority==='high')-Number(a.priority==='high')||Number(!b.platinumEarned)-Number(!a.platinumEarned)||(a.progress??101)-(b.progress??101)||a.title.localeCompare(b.title,'de'));
}
