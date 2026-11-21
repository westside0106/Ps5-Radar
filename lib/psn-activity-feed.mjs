// Source-aware personal activity timeline: only observed trophy timestamps and
// the SINGLE last-played timestamp PSN reports for each title. No synthetic sessions.
import {normalizeTrophyDates,dayKey} from './psn-trophy-heatmap.mjs';

const finiteDate=value=>{
 if(typeof value!=='string'||!value.trim())return null;
 const date=new Date(value);
 return Number.isFinite(date.getTime())&&date.getTime()>0?date:null;
};
const titleText=(value,fallback)=>typeof value==='string'&&value.trim()?value.trim().slice(0,150):fallback;
const gameId=game=>String(game?.titleId||game?.npTitleId||'').trim();
export function buildPersonalActivityFeed({played=[],titles=[],trophyDates=[],limit=120,now=new Date()}={}){
 const dateNow=now instanceof Date&&Number.isFinite(now.getTime())?now:new Date();
 const maxTime=dateNow.getTime()+5*60*1000; // reject future timestamps; tolerate clock skew
 const titleSets=new Map();
 for(const t of Array.isArray(titles)?titles:[]){
  if(t?.npCommunicationId)titleSets.set(String(t.npCommunicationId),titleText(t.trophyTitleName,'Unbekanntes Spiel'));
 }
 const validTrophies=normalizeTrophyDates(trophyDates).filter(t=>Date.parse(t.at)<=maxTime);
 const grouped=new Map();
 for(const row of validTrophies){
  const day=dayKey(row.at);
  if(!day)continue;
  const id=row.set+'|'+day;
  const previous=grouped.get(id);
  if(previous){previous.count++;if(row.at>previous.at)previous.at=row.at;}
  else grouped.set(id,{kind:'trophy',id:'trophy:'+id,at:row.at,day,title:titleSets.get(row.set)||'Trophäenliste '+row.set,setId:row.set,count:1,source:'trophy-cache'});
 }
 const recentGames=new Map();
 for(const game of Array.isArray(played)?played:[]){
  if(!game||typeof game!=='object')continue;
  const at=finiteDate(game.lastPlayedDateTime);
  if(!at||at.getTime()>maxTime)continue;
  const title=titleText(game.name||game.titleName,'');
  if(!title)continue;
  const id=gameId(game)||'title:'+title.toLocaleLowerCase('de')+':'+String(game.platform||game.category||'');
  const key='last-played:'+id;
  const previous=recentGames.get(key);
  if(!previous||at.toISOString()>previous.at)recentGames.set(key,{
   kind:'last-played',id:key,at:at.toISOString(),day:dayKey(at.toISOString()),title,
   source:'psn-last-played',count:1
  });
 }
 const all=[...grouped.values(),...recentGames.values()].sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
 const trophyEvents=grouped.size;
 const uniqueSets=new Set(validTrophies.map(t=>t.set));
 const trophyUnlocks=validTrophies.length;
 const datesWithActivity=new Set(all.map(e=>e.day));
 return {
  events:all.slice(0,Math.max(1,Math.min(300,Number.isInteger(limit)?limit:120))),
  totalEvents:all.length,trophyUnlocks,trophyEvents,
  knownLastPlayed:recentGames.size,knownTrophySets:uniqueSets.size,
  activeDates:datesWithActivity.size,dayKey:dayKey(dateNow.toISOString()),
  coverage:'partial',
  explanation:'Die Trophäen stammen ausschließlich aus geöffneten PSN-Trophäenlisten. Spielereignisse sind nur der letzte bekannte Spielzeitpunkt je Titel, keine vollständigen Spielsitzungen.'
 };
}
