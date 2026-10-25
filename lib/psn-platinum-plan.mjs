// Shared, conservative linkage between a played PSN title and its trophy sets.
// No fuzzy title matching: different editions and platforms can have different lists.
export function trophyTitleKey(value){
 return String(value||'').normalize('NFKC').replace(/[®™]/g,'').replace(/[’‘]/g,"'")
  .replace(/\s*(?:\(|\[)\s*(?:PS[345]|PlayStation\s*[345])(?:\s*[&+]\s*(?:PS[345]|PlayStation\s*[345]))?\s*(?:\)|\])\s*$/i,'')
  .replace(/\s+(?:PS4|PS5)(?:\s*[&+]\s*(?:PS4|PS5))?\s*$/i,'')
  .replace(/\s+/g,' ').trim().toLocaleLowerCase('de');
}
export function trophySetCandidates(game,titles=[]){
 const id=String(game?.titleId||'');
 const key=trophyTitleKey(game?.name||game?.titleName||'');
 if(!key&&!id)return [];
 const sets=(Array.isArray(titles)?titles:[]).filter(t=>t?.npCommunicationId&&
  (trophyTitleKey(t.trophyTitleName)===key||
   Array.isArray(t.npTitleIds)&&t.npTitleIds.some(v=>String(typeof v==='string'?v:v?.npTitleId||'')===id&&id)));
 const unique=new Map();
 for(const t of sets)unique.set(String(t.npCommunicationId),t);
 return [...unique.values()];
}
export const trophyId=t=>String(t?.trophyId??'');
export function baseTrophy(t){
 const group=String(t?.trophyGroupId??'default');
 return ['default','000','0','00'].includes(group);
}
export function platinumSummary(trophies,targetIds=[],manualDoneIds=[]){
 const items=Array.isArray(trophies)?trophies:[];
 const targets=new Set(targetIds.map(String)),manual=new Set(manualDoneIds.map(String));
 const base=items.filter(t=>baseTrophy(t)&&t.trophyType!=='platinum');
 const selected=items.filter(t=>targets.has(trophyId(t)));
 return {
  baseTotal:base.length,baseEarned:base.filter(t=>t.earned===true).length,
  remainingBase:base.filter(t=>t.earned!==true).length,
  targetsTotal:selected.length,
  targetsPsnEarned:selected.filter(t=>t.earned===true).length,
  targetsManualDone:selected.filter(t=>t.earned!==true&&manual.has(trophyId(t))).length
 };
}
