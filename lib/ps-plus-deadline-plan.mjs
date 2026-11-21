// PS Plus deadline presentation from verified dates only.
// Essential: time to CLAIM monthly games. Extra/Premium: removal from catalog.
// These two deadlines are different and MUST NOT be conflated.
import {berlinDay, currentEssential, monthlyClaimEnd} from './ps-plus-current.mjs';

function strictDay(input){
 if(typeof input!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input))return null;
 const date=new Date(input+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===input?input:null;
}
function daysUntil(today,day){
 const a=strictDay(today),b=strictDay(day);
 return a&&b?Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000):null;
}
function officialUrl(raw){
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&['www.playstation.com','playstation.com','blog.de.playstation.com','blog.playstation.com'].includes(url.hostname)?url.href:null;
 }catch{return null}
}
export function plusDeadlineOverview({radar={},catalog={},now=new Date()}={}){
 const today=berlinDay(now);
 const essential=currentEssential(radar,catalog,now);
 const claimEnd=monthlyClaimEnd(radar);
 const claim=essential.kind==='monthly'&&strictDay(claimEnd)&&claimEnd>=today&&essential.games?.length
  ?{
    kind:'claim',deadline:claimEnd,daysLeft:daysUntil(today,claimEnd),
    label:String(essential.label||''),games:essential.games.map(g=>({title:String(g.title||'').trim(),storeUrl:officialUrl(g.storeUrl)})).filter(g=>g.title),
    sourceUrl:officialUrl(essential.sourceUrl)||'https://www.playstation.com/de-de/ps-plus/games/'
   }:null;

 const checkedAt=Date.parse(catalog?.checkedAt||'');
 const age=now.getTime()-checkedAt;
 const fresh=Number.isFinite(checkedAt)&&checkedAt>0&&age>=0&&age<=48*60*60*1000;
 const completeExtra=catalog?.sections?.extra?.complete===true;
 const completePremium=catalog?.sections?.classics?.complete===true;
 const knownSource=officialUrl(catalog?.sourceUrl);
 const unique=new Map();
 if(fresh&&knownSource){
  for(const game of Array.isArray(catalog?.games)?catalog.games:[]){
   if(!game||typeof game!=='object'||!strictDay(game.leavingAt)||game.leavingAt<today)continue;
   const services=(Array.isArray(game.services)?game.services:[]).filter(s=>(s==='extra'&&completeExtra)||(s==='premium'&&completePremium));
   if(!services.length||!game.id||!game.title)continue;
   const key=String(game.id),before=unique.get(key);
   const row={id:key,title:String(game.title),deadline:game.leavingAt,daysLeft:daysUntil(today,game.leavingAt),
    services,storeUrl:officialUrl(game.storeUrl),sourceUrl:knownSource,
    estimatedHours:Number.isFinite(game.playtimeHours)&&game.playtimeHours>0?game.playtimeHours:null};
   if(!before||row.deadline<before.deadline)unique.set(key,row);
  }
 }
 const departures=[...unique.values()].sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.title.localeCompare(b.title,'de'));
 return {
  today,claim,departures,
  departureCoverage:departures.length?'confirmed':'unknown',
  sourceFresh:fresh,sourceCheckedAt:strictDay(typeof catalog?.checkedAt==='string'?catalog.checkedAt.slice(0,10):''),
  sourceUrl:knownSource||'https://www.playstation.com/de-de/ps-plus/games/',
  // Catalog expiry and monthly claim windows are not interchangeable.
  explanation:'Essential: Frist zum Hinzufügen monatlicher Spiele. Extra/Premium: bestätigter Termin der Katalogentfernung. Fehlende Termine sind unbekannt.'
 };
}
