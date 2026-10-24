// Optional server-side metadata providers. No browser credentials or fuzzy edition matching.
import {psnTitleKey} from './psn-game-metadata.mjs';
const cache=new Map();
const TTL=12*60*60*1000;
const allowedImage=(value,hostname)=>{
  try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname===hostname||u.hostname.endsWith('.'+hostname))?u.href:null}catch{return null}
};
const normalize=s=>psnTitleKey(s||'');
const justGame=(name,results)=>results.filter(g=>normalize(g.name)===normalize(name));
async function readJson(url,headers={}){
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(5500),cache:'no-store'});
 if(!response.ok)throw Error('Provider HTTP '+response.status);
 return response.json();
}
export async function getExternalGameSources(name=''){
 const title=String(name).trim();
 if(title.length<3||title.length>125)return {status:'invalid-title',rawg:null,artwork:null};
 const key=normalize(title), previous=cache.get(key);
 if(previous?.expires>Date.now())return previous.data;
 const data={status:'ready',rawg:null,artwork:null,providers:{rawg:process.env.RAWG_API_KEY?'no-match':'not-configured',steamgriddb:process.env.STEAMGRIDDB_API_KEY?'no-match':'not-configured'}};
 const work=[];
 if(process.env.RAWG_API_KEY)work.push((async()=>{
  const q=new URLSearchParams({key:process.env.RAWG_API_KEY,search:title,page_size:'12',search_precise:'true'});
  const list=await readJson('https://api.rawg.io/api/games?'+q);
  const exact=justGame(title,list.results||[]);
  // A collision between distinct entries is unsafe: prefer platform game only if unique.
  const choices=exact.filter(g=>(g.platforms||[]).some(p=>/PlayStation [345]/.test(p.platform?.name||'')));
  const matches=choices.length?choices:exact;
  if(matches.length!==1)return;
  const game=matches[0];
  data.providers.rawg='ready';
  data.rawg={
    name:game.name,metacritic:Number.isFinite(game.metacritic)?game.metacritic:null,
    rating:Number.isFinite(game.rating)?game.rating:null,ratingCount:game.ratings_count||null,
    genres:(game.genres||[]).map(g=>g.name).filter(Boolean).slice(0,5),
    released:game.released||null,
    background:allowedImage(game.background_image,'rawg.io'),
    url:'https://rawg.io/games/'+encodeURIComponent(game.slug)
  };
 })());
 if(process.env.STEAMGRIDDB_API_KEY)work.push((async()=>{
  const headers={Authorization:'Bearer '+process.env.STEAMGRIDDB_API_KEY};
  const search=await readJson('https://www.steamgriddb.com/api/v2/search/autocomplete/'+encodeURIComponent(title),headers);
  const exact=justGame(title,search.data||[]);
  if(exact.length!==1)return;
  const id=exact[0].id;
  if(!Number.isInteger(id))return;
  const [heroes,grids,logos]=await Promise.all([
   readJson('https://www.steamgriddb.com/api/v2/heroes/game/'+id,headers),
   readJson('https://www.steamgriddb.com/api/v2/grids/game/'+id+'?dimensions=600x900',headers),
   readJson('https://www.steamgriddb.com/api/v2/logos/game/'+id,headers)
  ]);
  const pick=items=>(items||[]).map(i=>allowedImage(i.url,'steamgriddb.com')).find(Boolean)||null;
  data.providers.steamgriddb='ready';
  data.artwork={hero:pick(heroes.data),cover:pick(grids.data),logo:pick(logos.data),source:'SteamGridDB'};
 })());
 const outcomes=await Promise.allSettled(work);
 if(outcomes.some(x=>x.status==='rejected'))data.status='partial';
  let i=0;for(const provider of ['rawg','steamgriddb'])if(process.env[provider==='rawg'?'RAWG_API_KEY':'STEAMGRIDDB_API_KEY']){if(outcomes[i++]?.status==='rejected')data.providers[provider]='error';}
 if(!work.length)data.status='not-configured';
 cache.set(key,{data,expires:Date.now()+TTL});
 return data;
}
