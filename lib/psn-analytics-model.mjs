import {playDurationMinutes} from './psn-advanced-stats.mjs';
import {mergeObservedSessions} from './psn-monitor-import.mjs';
export function buildAnalyticsModel(payload){
 const sources=payload?.sources||{};
 const psn=sources.psn?.data||{};
 const profile=sources.profile?.data?.record?.payload||{};
 const rows=v=>Array.isArray(v)?v:[];
 const games=rows(psn.played?.titles).map(g=>({
  id:String(g.titleId||''),title:String(g.name||g.titleName||''),platform:String(g.category||g.platform||''),
  sonyMinutes:playDurationMinutes(g.playDuration),lastPlayed:g.lastPlayedDateTime||null
 }));
 const trophies=rows(psn.trophies?.trophyTitles).map(t=>({
  id:String(t.npCommunicationId||''),title:String(t.trophyTitleName||''),platform:String(t.trophyTitlePlatform||''),
  progress:t.progress??null,bronze:t.earnedTrophies?.bronze??null,silver:t.earnedTrophies?.silver??null,
  gold:t.earnedTrophies?.gold??null,platinum:t.earnedTrophies?.platinum??null
 }));
 return {generatedAt:payload?.generatedAt||null,games,trophies,
  library:rows(sources.library?.data?.titles),purchases:rows(profile.purchases),
  observedSessions:mergeObservedSessions(profile.observedSessions,sources.monitor?.data?.sessions),history:rows(profile.history),
  trophyDates:profile.trophyDates||{},trophyTargets:profile.trophyTargets||{},
  coverage:Object.fromEntries(Object.entries(sources).map(([key,value])=>[key,value.available===true])),
  warnings:rows(psn.errors),paginationComplete:psn.played?.paginationComplete??null,
  sonyMinutes:games.reduce((sum,g)=>sum+(Number.isFinite(g.sonyMinutes)?g.sonyMinutes:0),0)
 };
}
