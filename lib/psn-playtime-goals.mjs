// Personal playtime targets are *user-supplied plans*, never inferred from Sony
// total-duration readings, trophies or sampled psn_monitor activity.
import {playDurationMinutes} from './psn-advanced-stats.mjs';
import {normalizeObservedSessions} from './psn-monitor-import.mjs';

export const TIME_GOAL_TYPES={
 personal:'Eigene Spielzeit',
 story:'Story-Ziel',
 platinum:'Platin-Ziel'
};
export function normalizeTimeGoalHours(value){
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='number'&&typeof value!=='string')return null;
 if(typeof value==='string'&&!/^\\d{1,4}(?:[.,]\\d{1,2})?$/.test(value.trim()))return null;
 const n=typeof value==='number'?value:Number(value.trim().replace(',','.'));
 if(!Number.isFinite(n)||n<0.5||n>1000||Math.abs(n*2-Math.round(n*2))>1e-9)return null;
 return n;
}
export function normalizeTimeGoalType(value){
 return Object.hasOwn(TIME_GOAL_TYPES,value)?value:'personal';
}
export function normalizedPlaytimeTitle(name){
 return String(name||'').normalize('NFKC')
  .replace(/[®™]/g,'')
  .replace(/\\s*\\((?:PS[345]|PlayStation\\s*[345])\\)\\s*$/i,'')
  .replace(/\\s+/g,' ').trim().toLocaleLowerCase('de');
}
const displayTitle=x=>String(x?.name||x?.titleName||'').trim();
const displayId=x=>String(x?.key||x?.game?.titleId||'').trim();

export function buildPlaytimeGoalInsights(games=[],notes={},observations=[]){
 const list=Array.isArray(games)?games:[];
 const saved=notes&&typeof notes==='object'&&!Array.isArray(notes)?notes:{};
 const filtered=new Map();
 for(const item of list){
  const id=displayId(item),name=displayTitle(item);
  if(!id||!name||filtered.has(id))continue;
  filtered.set(id,{key:id,name,game:item.game||{},note:saved[id]&&typeof saved[id]==='object'?saved[id]:{}});
 }
 const rows=[...filtered.values()].map(item=>{
  const goalHours=normalizeTimeGoalHours(item.note.timeGoalHours);
  const psnMinutes=playDurationMinutes(item.game.playDuration);
  const pastEstimate=Number(item.game.communityInsight?.platinumHours);
  return {
   key:item.key,name:item.name,status:String(item.note.status||''),
   priority:String(item.note.priority||''),
   goalHours,goalKind:normalizeTimeGoalType(item.note.timeGoalType),
   psnMinutes,observedMinutes:0,observedSessions:0,observationMatch:'none',
   communityPlatinumHours:Number.isFinite(pastEstimate)&&pastEstimate>0&&pastEstimate<=1000?pastEstimate:null,
   progressPct:goalHours!==null&&psnMinutes!==null?Math.min(100,Math.round(psnMinutes/(goalHours*60)*100)):null,
   distanceMinutes:goalHours!==null&&psnMinutes!==null?Math.max(0,Math.round(goalHours*60-psnMinutes)):null
  };
 });
 // Exact normalized title matching only. Never assign observations to multiple
 // platform editions or similarly named games without an explicit link.
 const names=new Map();
 for(const row of rows){
  const name=normalizedPlaytimeTitle(row.name);
  if(!name)continue;
  const group=names.get(name)||[];
  group.push(row);
  names.set(name,group);
 }
 const sessions=normalizeObservedSessions(observations);
 const unmatched=new Map();
 for(const session of sessions){
  const name=normalizedPlaytimeTitle(session.game),matches=names.get(name)||[];
  if(matches.length!==1){
   const record=unmatched.get(name)||{name:session.game,sessions:0,minutes:0,reason:matches.length>1?'Mehrdeutiger Titel':'Keine exakte Zuordnung'};
   record.sessions++;record.minutes+=session.minutes;
   unmatched.set(name,record);continue;
  }
  const row=matches[0];
  row.observedMinutes=Math.round((row.observedMinutes+session.minutes)*10)/10;
  row.observedSessions++;
  row.observationMatch='exact-title';
 }
 return {
  rows,
  totalGames:rows.length,
  goalCount:rows.filter(x=>x.goalHours!==null).length,
  comparable:rows.filter(x=>x.goalHours!==null&&x.psnMinutes!==null).length,
  observedGames:rows.filter(x=>x.observedSessions>0).length,
  observedSessions:sessions.length,
  observedTotalMinutes:sessions.reduce((sum,x)=>sum+x.minutes,0),
  unmatchedObservations:[...unmatched.values()].sort((a,b)=>b.minutes-a.minutes||a.name.localeCompare(b.name,'de')),
  observationRange:sessions.length?{
   start:sessions.reduce((a,b)=>a<b.start?a:b.start,sessions[0].start),
   end:sessions.reduce((a,b)=>a>b.end?a:b.end,sessions[0].end)
  }:null
 };
}
