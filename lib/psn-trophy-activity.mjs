// Earned Sony trophy timestamps observed after user explicitly opens trophy details.
// Never derive trophy unlocks from aggregate counts or playtime.
export const TROPHY_ACTIVITY_KEY='psn-earned-trophy-events-v1';
export function safeEarnedDate(value,now=new Date()){
 if(typeof value!=='string')return null;
 const date=new Date(value);
 if(!Number.isFinite(date.getTime())||date.getTime()>now.getTime()+86400000||date.getUTCFullYear()<2006)return null;
 return date.toISOString().slice(0,10);
}
export function mergeEarnedActivity(saved={},setId,trophies=[],now=new Date()){
 const next={};
 if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
  for(const [key,date] of Object.entries(saved).slice(-6000)){
   if(typeof key!=='string'||key.length>150)continue;
   if(/^\d{4}-\d{2}-\d{2}$/.test(date))next[key]=date;
  }
 }
 if(typeof setId!=='string'||!/^[a-zA-Z0-9_-]{4,100}$/.test(setId))return next;
 for(const trophy of Array.isArray(trophies)?trophies:[]){
  if(trophy?.earned!==true)continue;
  const date=safeEarnedDate(trophy.earnedDateTime,now),id=String(trophy.trophyId??'');
  if(!date||!id||id.length>20)continue;
  next[setId+':'+id]=date;
 }
 const entries=Object.entries(next).sort((a,b)=>b[1].localeCompare(a[1])).slice(0,5000);
 return Object.fromEntries(entries);
}
export function recentTrophyDays(activity={},now=new Date(),days=364){
 const base=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 const count=new Map();
 for(const v of Object.values(activity&&typeof activity==='object'&&!Array.isArray(activity)?activity:{})){
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))continue;
  const n=new Date(v+'T00:00:00Z');
  if(!Number.isFinite(n.getTime())||n>base)continue;
  count.set(v,(count.get(v)||0)+1);
 }
 const n=Math.max(7,Math.min(371,days));
 const dates=Array.from({length:n},(_,i)=>{
  const d=new Date(base);d.setUTCDate(d.getUTCDate()-(n-1-i));
  const date=d.toISOString().slice(0,10);
  return {date,count:count.get(date)||0};
 });
 return {days:dates,total:dates.reduce((a,x)=>a+x.count,0),activeDays:dates.filter(d=>d.count>0).length,peak:dates.reduce((a,b)=>b.count>a.count?b:a,{date:'',count:0})};
}
