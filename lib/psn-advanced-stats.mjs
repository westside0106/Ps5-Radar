// Source-aware, read-only aggregates of PSN games and trophy titles.
// No event/session history is inferred from cumulative playtime or lastPlayedDateTime.
const MEDIA=/^(?:youtube(?:\s+(?:vr|music))?|spotify|prime video|amazon prime video|netflix|twitch|disney\+?|apple tv|hulu|plex|crunchyroll)(?:\s*\([^)]*\))?$/i;
const norm=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase('de');

export function playDurationMinutes(value){
 if(value===null||value===undefined||value==='')return null;
 if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
 if(typeof value!=='string')return null;
 const m=value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
 if(!m||!m.slice(1).some(x=>x!==undefined))return null;
 const minutes=Number(m[1]||0)*1440+Number(m[2]||0)*60+Number(m[3]||0)+Number(m[4]||0)/60;
 return Number.isFinite(minutes)&&minutes>=0?minutes:null;
}
const timeBands=[
 {label:'Unter 1 Std.',min:0,max:60},
 {label:'1–10 Std.',min:60,max:600},
 {label:'10–50 Std.',min:600,max:3000},
 {label:'50–100 Std.',min:3000,max:6000},
 {label:'100+ Std.',min:6000,max:Infinity}
];
export function buildPlaytimeInsights(played=[]){
 const unique=new Map();
 for(const game of Array.isArray(played)?played:[]){
  if(!game||typeof game!=='object')continue;
  const title=String(game.name||game.titleName||'').trim();
  if(!title||MEDIA.test(title))continue;
  const id=String(game.titleId||game.npTitleId||'').trim()||'name:'+norm(title)+':'+norm(game.platform||game.category);
  const minutes=playDurationMinutes(game.playDuration);
  const previous=unique.get(id);
  if(!previous||(minutes!==null&&(previous.minutes===null||minutes>previous.minutes)))unique.set(id,{id,title,minutes,game});
 }
 const rows=[...unique.values()],known=rows.filter(x=>x.minutes!==null);
 const totalMinutes=known.reduce((sum,x)=>sum+x.minutes,0);
 const sorted=[...known].sort((a,b)=>a.minutes-b.minutes);
 const genreMap=new Map();
 for(const x of known){
  const raw=x.game.metadata?.genres??x.game.genres;
  const labels=Array.isArray(raw)?raw:typeof raw==='string'?[raw]:[];
  const names=[...new Set(labels.map(v=>typeof v==='string'?v:typeof v?.name==='string'?v.name:'').map(s=>s.trim()).filter(Boolean))];
  for(const name of names){
   const key=norm(name),stat=genreMap.get(key)||{name,games:0,minutes:0};
   stat.games++;stat.minutes+=x.minutes;genreMap.set(key,stat);
  }
 }
 return {
  games:rows.length,knownGames:known.length,unknownGames:rows.length-known.length,
  totalMinutes,averageMinutes:known.length?totalMinutes/known.length:null,
  medianMinutes:sorted.length?(sorted[Math.floor((sorted.length-1)/2)].minutes+sorted[Math.floor(sorted.length/2)].minutes)/2:null,
  bands:timeBands.map(b=>({label:b.label,count:known.filter(x=>x.minutes>=b.min&&x.minutes<b.max).length})),
  genres:[...genreMap.values()].sort((a,b)=>b.minutes-a.minutes||a.name.localeCompare(b.name,'de')).slice(0,6),
  top:[...known].sort((a,b)=>b.minutes-a.minutes||a.title.localeCompare(b.title,'de')).slice(0,5).map(({id,title,minutes})=>({id,title,minutes}))
 };
}
const progressBands=[
 {label:'0 %',min:0,max:0},
 {label:'1–24 %',min:1,max:24},
 {label:'25–49 %',min:25,max:49},
 {label:'50–74 %',min:50,max:74},
 {label:'75–99 %',min:75,max:99},
 {label:'100 %',min:100,max:100}
];
export function buildTrophyInsights(titles=[]){
 const sets=new Map();
 for(const title of Array.isArray(titles)?titles:[]){
  if(!title||!title.npCommunicationId)continue;
  const id=String(title.npCommunicationId);
  if(!sets.has(id))sets.set(id,title);
 }
 const rows=[...sets.values()];
 const known=rows.filter(t=>t.progress!==null&&t.progress!==undefined&&t.progress!==''&&Number.isFinite(Number(t.progress))&&Number(t.progress)>=0&&Number(t.progress)<=100);
 const counts={bronze:0,silver:0,gold:0,platinum:0};
 for(const t of rows){
  for(const type of Object.keys(counts)){
   const n=Number(t.earnedTrophies?.[type]);
   if(Number.isFinite(n)&&n>0)counts[type]+=Math.floor(n);
  }
 }
 const platinumSets=rows.filter(t=>Number(t.earnedTrophies?.platinum)>0).length;
 return {
  trophySets:rows.length,knownSets:known.length,unknownSets:rows.length-known.length,
  platinumSets,completedSets:known.filter(t=>Number(t.progress)===100).length,
  completedWithoutPlatinum:known.filter(t=>Number(t.progress)===100&&!(Number(t.earnedTrophies?.platinum)>0)).length,
  earned:counts,
  bands:progressBands.map(b=>({label:b.label,count:known.filter(t=>Number(t.progress)>=b.min&&Number(t.progress)<=b.max).length}))
 };
}
