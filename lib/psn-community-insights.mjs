// Historical, third-party estimates. Not a live PS Plus / PSN / IGDB feed.
import {titleKey} from './ps-plus-catalog.mjs';
import {GAME_ESTIMATES_TSV, SOURCE_MONTH, SOURCE_NAME} from '../data/psplus-oliveocelot-2026-09.mjs';

export function insightTitleKey(title='') {
  const clean=String(title).replace(/[®™©]/g,'').normalize('NFKC')
    .replace(/\s*(?:\(|\[)\s*(?:(?:PS4|PS5|PlayStation\s*[345])(?:\s*[&+]\s*(?:PS4|PS5|PlayStation\s*[345]))?)\s*(?:\)|\])\s*$/i,'')
    .replace(/\s+(?:PS4|PS5)(?:\s*[&+]\s*(?:PS4|PS5))?\s*$/i,'');
  const key=titleKey(clean);
  // Verified title typography/numbering aliases only. Never fuzzy-match editions or DLCs.
  return ({
    'red dead redemption 2':'red dead redemption ii',
    'god of war ragnarok':'god of war ragnarok',
    'god of war ragnaro k':'god of war ragnarok',
    'the last of us part i':'the last of us part 1'
  })[key]||key;
}

function numberOrNull(value) {
  if(value==null||String(value).trim()==='')return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
}

export function parseCommunityInsights(tsv=GAME_ESTIMATES_TSV) {
  const byName=new Map(),ambiguous=new Set();
  for(const row of tsv.split(/\r?\n/)){
    if(!row||row.startsWith('#'))continue;
    const columns=row.split('|');
    if(columns.length!==8)continue;
    const [title,rushed,platinum,metacritic,userScore,averageScore,status,removedNote]=columns;
    const key=insightTitleKey(title);
    if(!key||ambiguous.has(key))continue;
    if(byName.has(key)){byName.delete(key);ambiguous.add(key);continue;}
    byName.set(key,{
      title,rushedHours:numberOrNull(rushed),platinumHours:numberOrNull(platinum),
      metacritic:numberOrNull(metacritic),userScore:numberOrNull(userScore),
      averageScore:numberOrNull(averageScore),
      historicalStatus:status==='E'?'removed':status==='Z'?'additional':'listed',
      removedNote:removedNote||null,source:SOURCE_NAME,asOf:SOURCE_MONTH
    });
  }
  return byName;
}

const estimates=parseCommunityInsights();
export function communityInsightFor(title='') {
  return estimates.get(insightTitleKey(title))||null;
}

export const communityInsightCount=estimates.size;
