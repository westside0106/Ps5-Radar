// Pure collection and manually planned game helpers. Never infer PSN ownership from a manual entry.
export const COLLECTIONS_KEY='psn-game-collections-v1';
export const CUSTOM_GAMES_KEY='psn-custom-games-v1';
export const VIEW_KEY='psn-game-library-view-v1';
export const VIEWS=['cards','list','shelf'];

export const gameKey=game=>String(game?.titleId||game?.name||game?.titleName||'');
export const isManualGame=game=>Boolean(game?.isManual||String(game?.titleId||'').startsWith('custom:'));
export const isValidManualGame=game=>Boolean(game&&typeof game==='object'&&typeof game.name==='string'&&game.name.trim().length>=3&&game.name.length<=120&&/^custom:[a-z0-9-]{3,100}$/.test(String(game.titleId||'')));
export function normalizeManualGames(raw){
 if(!Array.isArray(raw))return [];
 const items=new Map();
 for(const item of raw.slice(0,1000)){
  if(!isValidManualGame(item))continue;
  items.set(item.titleId,{titleId:item.titleId,name:item.name.trim(),isManual:true});
  if(items.size>=400)break;
 }
 return [...items.values()];
}
export function combinedGames(played=[],manual=[]){
 const result=new Map();
 for(const game of Array.isArray(played)?played:[]){
  const id=gameKey(game);if(id&&!result.has(id))result.set(id,game);
 }
 for(const game of normalizeManualGames(manual)){
  if(!result.has(game.titleId))result.set(game.titleId,game);
 }
 return [...result.values()];
}
export function normalizeCollections(raw){
 if(!Array.isArray(raw))return [];
 const unique=new Map();
 for(const entry of raw.slice(0,300)){
  if(!entry||typeof entry!=='object'||typeof entry.id!=='string'||!/^col:[a-z0-9-]{3,80}$/.test(entry.id)||typeof entry.name!=='string')continue;
  const name=entry.name.trim().replace(/\s+/g,' ').slice(0,42);
  if(name.length<2||unique.has(entry.id))continue;
  const games=[...new Set((Array.isArray(entry.gameIds)?entry.gameIds:[]).filter(v=>typeof v==='string'&&v.length>0&&v.length<=180))].slice(0,1500);
  unique.set(entry.id,{id:entry.id,name,gameIds:games});
  if(unique.size>=40)break;
 }
 return [...unique.values()];
}
export function filterCollection(games,collectionId,collections=[]){
 if(!collectionId)return games;
 const col=normalizeCollections(collections).find(c=>c.id===collectionId);
 if(!col)return games;
 const member=new Set(col.gameIds);
 return games.filter(g=>member.has(gameKey(g)));
}
export function toggleCollectionGame(collections,id,gameId){
 return normalizeCollections(collections).map(c=>c.id===id?{...c,gameIds:c.gameIds.includes(gameId)?c.gameIds.filter(x=>x!==gameId):[...c.gameIds,gameId]}:c);
}
