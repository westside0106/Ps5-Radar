// Enrich only user-visible game titles. PSN account identifiers and credentials never leave the server.
// Catalog fallback works without IGDB keys; live IGDB enrichment is optional.
import {titleKey} from './ps-plus-catalog.mjs';
import catalog from '../data/ps-plus-catalog.json' with {type:'json'};
import {communityInsightFor} from './psn-community-insights.mjs';

const psPlatforms=/^PlayStation(?: 2| 3| 4| 5| Portable| Vita)?$/;
const modeLabels={'Single player':'Solo','Multiplayer':'Mehrspieler','Co-operative':'Koop','Split screen':'Splitscreen','Massively Multiplayer Online (MMO)':'MMO'};
const perspectiveLabels={'First person':'First-Person','Third person':'Third-Person','Bird view / Isometric':'Isometrisch','Side view':'Seitenansicht','Virtual Reality':'VR'};
const igdbCache=new Map();
const igdbGalleryCache=new Map();
let tokenCache=null;

export function psnTitleKey(value='') {
  return titleKey(String(value).replace(/[®™]/g,'').normalize('NFKC')
    .replace(/\s*(?:\(|\[)\s*(?:(?:PS4|PS5|PlayStation\s*[345])(?:\s*[&+]\s*(?:PS4|PS5|PlayStation\s*[345]))?)\s*(?:\)|\])\s*$/i,'')
    .replace(/\s+(?:PS4|PS5)(?:\s*[&+]\s*(?:PS4|PS5))?\s*$/i,''));
}
const imageId = (id,size='cover_big_2x') =>
  typeof id==='string' && /^[a-zA-Z0-9_]+$/.test(id)
    ? 'https://images.igdb.com/igdb/image/upload/t_'+size+'/'+id+'.jpg' : null;

function fromCatalog(title) {
  const key=psnTitleKey(title);
  if(!key) return null;
  const candidates=(catalog.games||[]).filter(item=>psnTitleKey(item.title)===key);
  // Never silently turn a deluxe edition, remaster or expansion into another title.
  if(candidates.length!==1)return null;
  const game=candidates[0];
  return {
    coverUrl:game.image||null,
    summary:game.description||null,
    releaseDate:game.releaseDate||null,
    genres:game.genres||[],
    modes:game.modes||[],
    perspective:game.perspective||null,
    screenshotUrls:Array.isArray(game.screenshotUrls)?game.screenshotUrls.filter(u=>/^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_screenshot_big\/[A-Za-z0-9_]+\.jpg$/.test(u)).slice(0,5):[],
    rating:Number.isFinite(game.igdbRating)?Math.round(game.igdbRating):null,
    storeUrl:game.storeUrl||null,
    source:game.metadataSource==='IGDB'?'IGDB / PS-Plus-Katalog':'PS-Plus-Katalog',
    inPlus:(game.services||[]).filter(s=>['essential','extra','premium','ubisoft'].includes(s))
  };
}

function fromIgdb(game) {
  const release=Number.isInteger(game.first_release_date)
    ? new Date(game.first_release_date*1000).toISOString().slice(0,10) : null;
  return {
    coverUrl:imageId(game.cover?.image_id),
    summary:typeof game.summary==='string'?game.summary.slice(0,800):null,
    releaseDate:release,
    genres:(game.genres||[]).map(g=>g.name).filter(Boolean),
    modes:(game.game_modes||[]).map(g=>modeLabels[g.name]||g.name).filter(Boolean),
    perspective:(game.player_perspectives||[]).map(p=>perspectiveLabels[p.name]||p.name).find(Boolean)||null,
    screenshotUrls:(game.screenshots||[]).slice(0,5).map(s=>imageId(s.image_id,'screenshot_big')).filter(Boolean),
    rating:Number.isFinite(game.aggregated_rating)?Math.round(game.aggregated_rating):null,
    storeUrl:null, source:'IGDB', inPlus:[]
  };
}

function mergeMeta(local,live) {
  if(!local)return live;
  if(!live)return local;
  const choose=(a,b)=>a!=null && (!Array.isArray(a)||a.length)?a:b;
  return {
    ...live,
    coverUrl:choose(local.coverUrl,live.coverUrl),
    summary:choose(local.summary,live.summary),
    releaseDate:choose(local.releaseDate,live.releaseDate),
    genres:choose(local.genres,live.genres),
    modes:choose(local.modes,live.modes),
    perspective:choose(local.perspective,live.perspective),
    screenshotUrls:choose(live.screenshotUrls,local.screenshotUrls),
    storeUrl:local.storeUrl, inPlus:local.inPlus,
    source:'IGDB / PS-Plus-Katalog'
  };
}

async function igdbToken() {
  const client=process.env.IGDB_CLIENT_ID,secret=process.env.IGDB_CLIENT_SECRET;
  if(!client||!secret)return null;
  if(tokenCache&&tokenCache.until>Date.now())return tokenCache.value;
  const response=await fetch('https://id.twitch.tv/oauth2/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:client,client_secret:secret,grant_type:'client_credentials'}),
    signal:AbortSignal.timeout(5500),cache:'no-store'
  });
  if(!response.ok)throw Error('IGDB OAuth '+response.status);
  const json=await response.json();
  if(!json.access_token)return null;
  tokenCache={value:json.access_token,until:Date.now()+Math.max(300,Number(json.expires_in||3600)-300)*1000};
  return tokenCache.value;
}
function igdbSearchName(title) {return String(title).normalize('NFKC').replace(/[®™]/g,'').replace(/\s*(?:\(|\[)\s*(?:PlayStation\s*[345]|PS[345])\s*(?:\)|\])\s*$/i,'').replace(/\s+PS[45]\s*$/i,'').trim();}
function escapedTitle(title) {
  return title.replace(/["\\;\r\n]/g,' ').replace(/\s+/g,' ').slice(0,125).trim();
}
async function liveMetadata(names) {
  const missing=[...new Set(names.filter(Boolean))].filter(n=>!igdbCache.has(psnTitleKey(n)));
  if(!missing.length)return;
  const token=await igdbToken();
  if(!token)return;
  // Query several exact names per request instead of issuing one HTTP call per PSN title.
  // IGDB is rate-limited: do not exceed 4 requests per second.
  const now=Date.now();
  for(let i=0;i<missing.length;i+=24) {
    const group=missing.slice(i,i+24);
    const queryNames=[...new Set(group.map(n=>escapedTitle(igdbSearchName(n))).filter(Boolean))];
    const query='fields id,name,game_type,cover.image_id,summary,first_release_date,genres.name,game_modes.name,player_perspectives.name,platforms.name,aggregated_rating,screenshots.image_id; where name = ('+queryNames.map(n=>'"'+n+'"').join(',')+'); limit 250;';
    const response=await fetch('https://api.igdb.com/v4/games',{
      method:'POST',headers:{'Client-ID':process.env.IGDB_CLIENT_ID,'Authorization':'Bearer '+token,'Content-Type':'text/plain'},
      body:query,cache:'no-store',signal:AbortSignal.timeout(5500)
    });
    if(!response.ok)throw Error('IGDB metadata '+response.status);
    const records=await response.json();
    for(const title of group) {
      const key=psnTitleKey(title);
      const exact=records.filter(g=>psnTitleKey(g.name)===key && (g.platforms||[]).some(p=>psPlatforms.test(p.name||'')));
      const primary=exact.filter(g=>g.game_type===0||g.game_type==null);
      const choices=primary.length?primary:exact;
      // Prefer a fully described primary game over duplicate platform/edition records.
      const scored=choices.map(g=>({game:g,score:(g.summary?4:0)+(g.cover?.image_id?2:0)+(g.genres?.length?1:0)+(g.screenshots?.length?1:0)+(g.aggregated_rating!=null?1:0)})).sort((a,b)=>b.score-a.score);
      const best=scored[0]?.game||null;
      igdbCache.set(key,{at:now,value:best?fromIgdb(best):null});
    }
    if(i+24<missing.length)await new Promise(resolve=>setTimeout(resolve,270));
  }
}

export async function enrichPsnLibrary(played=[],titles=[]) {
  const all=played.map(g=>g.name||g.titleName||'');
  if(process.env.IGDB_CLIENT_ID&&process.env.IGDB_CLIENT_SECRET) {
    const needs=all.filter(name=>{const cached=igdbCache.get(psnTitleKey(name));return !cached||Date.now()-cached.at>6*60*60*1000;});
    if(needs.length) {
      for(const n of needs)igdbCache.delete(psnTitleKey(n));
      try{await liveMetadata(needs);}catch(error){console.warn('PSN IGDB metadata fallback:',error.message);}
    }
  }
  const attach=(game,title)=>{
    const local=fromCatalog(title),remote=igdbCache.get(psnTitleKey(title))?.value||null;
    const metadata=mergeMeta(local,remote);
    const communityInsight=communityInsightFor(title);
    if(!metadata&&!communityInsight)return game;
    return {...game,...(metadata?{metadata}:{}),...(communityInsight?{communityInsight}:{})};
  };
  return {
    played:played.map(g=>attach(g,g.name||g.titleName||'')),
    titles:titles.map(g=>attach(g,g.trophyTitleName||''))
  };
}


// Only called from an authenticated, on-demand gallery endpoint.
// A missing screenshot is not a reason to overwrite the existing PSN cover or playtime.
export async function getPsnGameGallery(title='') {
  const cleaned=igdbSearchName(title);
  if(cleaned.length<3||cleaned.length>125)return {screenshots:[],status:'invalid-title'};
  if(!process.env.IGDB_CLIENT_ID||!process.env.IGDB_CLIENT_SECRET)return {screenshots:[],status:'not-configured'};
  const key=psnTitleKey(cleaned),cached=igdbGalleryCache.get(key);
  if(cached&&cached.until>Date.now())return cached.value;
  try{
    const token=await igdbToken();
    if(!token)return {screenshots:[],status:'not-configured'};
    const query='search "'+escapedTitle(cleaned)+'"; fields id,name,game_type,platforms.name,screenshots.image_id; limit 40;';
    const response=await fetch('https://api.igdb.com/v4/games',{
      method:'POST',headers:{'Client-ID':process.env.IGDB_CLIENT_ID,'Authorization':'Bearer '+token,'Content-Type':'text/plain'},
      body:query,cache:'no-store',signal:AbortSignal.timeout(6500)
    });
    if(!response.ok)throw Error('IGDB gallery '+response.status);
    const records=await response.json();
    const exact=records.filter(g=>psnTitleKey(g.name)===key&&(g.platforms||[]).some(p=>psPlatforms.test(p.name||'')));
    const primary=exact.filter(g=>g.game_type===0||g.game_type==null);
    const candidates=primary.length?primary:exact;
    candidates.sort((a,b)=>(b.screenshots?.length||0)-(a.screenshots?.length||0));
    const screenshots=(candidates[0]?.screenshots||[]).slice(0,6).map(p=>imageId(p.image_id,'screenshot_big')).filter(Boolean);
    const value={screenshots,status:screenshots.length?'ready':'no-images'};
    igdbGalleryCache.set(key,{value,until:Date.now()+6*60*60*1000});
    return value;
  }catch(error){
    console.warn('IGDB gallery fallback:',error.message);
    return {screenshots:[],status:'error'};
  }
}
