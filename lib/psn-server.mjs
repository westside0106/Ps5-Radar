// Private, read-only PlayStation account integration. No credentials are returned to clients.
const AUTH='https://ca.account.sony.com/api/authz/v3/oauth';
const CLIENT='09515159-7237-4370-9b40-3806e67c0891';
const REDIRECT='com.scee.psxandroid.scecompcall://redirect';
let cache=null;
async function jsonResponse(response) {
  if (!response.ok) throw new Error('PlayStation antwortet mit HTTP '+response.status);
  return response.json();
}
async function accessToken() {
  const npsso=process.env.PSN_NPSSO;
  if (!npsso || !/^[A-Za-z0-9]{32,128}$/.test(npsso)) throw new Error('PSN_NPSSO fehlt oder ist ungültig formatiert.');
  const params=new URLSearchParams({access_type:'offline',client_id:CLIENT,redirect_uri:REDIRECT,response_type:'code',scope:'psn:mobile.v2.core psn:clientapp'});
  const response=await fetch(AUTH+'/authorize?'+params,{headers:{Cookie:'npsso='+npsso},redirect:'manual',cache:'no-store'});
  const location=response.headers.get('location');
  if (!location) throw new Error('Sony-Anmeldung fehlgeschlagen. NPSSO prüfen.');
  const code=new URL(location).searchParams.get('code');
  if (!code) throw new Error('Sony hat keinen Autorisierungscode geliefert.');
  const tokens=await jsonResponse(await fetch(AUTH+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(CLIENT+':ucPjka5tntB2KqsP').toString('base64')},body:new URLSearchParams({code,redirect_uri:REDIRECT,grant_type:'authorization_code',token_format:'jwt'}),cache:'no-store'}));
  if (!tokens.access_token) throw new Error('Sony hat keinen Zugriffstoken geliefert.');
  return tokens.access_token;
}
async function psnGet(url,token,extraHeaders={}) {
  return jsonResponse(await fetch(url,{headers:{Authorization:'Bearer '+token,'Accept-Language':'de-DE',...extraHeaders},cache:'no-store',signal:AbortSignal.timeout(12000)}));
}
export async function getPsnDashboard({force=false}={}) {
  if (!process.env.PSN_NPSSO) return {connected:false,configured:false};
  if (!force && cache && Date.now()-cache.at<300000) return cache.value;
  const token=await accessToken();
  const urls={
    summary:'https://m.np.playstation.com/api/trophy/v1/users/me/trophySummary',
    trophies:'https://m.np.playstation.com/api/trophy/v1/users/me/trophyTitles?limit=100',
    played:'https://m.np.playstation.com/api/gamelist/v2/users/me/titles?limit=100'
  };
  const results=await Promise.allSettled(Object.entries(urls).map(async ([key,url])=>[key,await psnGet(url,token)]));
  const data={connected:true,configured:true,checkedAt:new Date().toISOString(),errors:[]};
  for(let i=0;i<results.length;i++){
    const name=Object.keys(urls)[i], result=results[i];
    if(result.status==='fulfilled') data[name]=result.value[1];
    else data.errors.push(name+': '+String(result.reason?.message||'nicht verfügbar'));
  }
  // Trophy summary is account-wide, but the titles endpoint returns pages (100 per page).
  // Fetch further pages conservatively; never alter Sony's account totals.
  if(Array.isArray(data.trophies?.trophyTitles)&&data.trophies.trophyTitles.length===100){
    const collected=[...data.trophies.trophyTitles];
    const seen=new Set(collected.map(t=>String(t.npCommunicationId||t.trophyTitleName||'')));
    for(let offset=100;offset<1000;offset+=100){
      try{
        const next=await psnGet('https://m.np.playstation.com/api/trophy/v1/users/me/trophyTitles?limit=100&offset='+offset,token);
        const items=Array.isArray(next.trophyTitles)?next.trophyTitles:[];
        let fresh=0;
        for(const item of items){const id=String(item.npCommunicationId||item.trophyTitleName||'');if(!id||seen.has(id))continue;seen.add(id);collected.push(item);fresh++}
        if(items.length<100||fresh===0)break;
      }catch(error){data.errors.push('trophies pagination: '+String(error?.message||'nicht verfügbar'));break}
    }
    data.trophies={...data.trophies,trophyTitles:collected,loadedTitleCount:collected.length};
  }
  // Sony's played-games endpoint is paginated; a single response only covers 100 titles.
  if(Array.isArray(data.played?.titles)&&data.played.titles.length===100){
    const collected=[...data.played.titles];
    const identity=t=>String(t.titleId||'')||String(t.name||t.titleName||'')+'|'+String(t.category||t.platform||'');
    const seen=new Set(collected.map(identity));
    const total=Number(data.played.totalItemCount);
    let complete=false;
    for(let offset=100;offset<1500;offset+=100){
      if(Number.isFinite(total)&&total>0&&offset>=total){complete=true;break}
      try{
        const page=await psnGet('https://m.np.playstation.com/api/gamelist/v2/users/me/titles?limit=100&offset='+offset,token);
        const items=Array.isArray(page?.titles)?page.titles:[];
        let added=0;
        for(const item of items){const id=identity(item);if(!id||seen.has(id))continue;seen.add(id);collected.push(item);added++}
        if(items.length<100){complete=true;break}
        if(added===0){data.errors.push('played pagination: wiederholte Seite, Abruf vorsorglich angehalten');break}
      }catch(error){data.errors.push('played pagination: '+String(error?.message||'nicht verfügbar'));break}
    }
    data.played={...data.played,titles:collected,loadedTitleCount:collected.length,paginationComplete:complete||Number.isFinite(total)&&total>0&&collected.length>=total};
  }
  if (!data.summary && !data.trophies && !data.played) throw new Error('PSN-Daten konnten nicht geladen werden: '+data.errors.join('; '));
  cache={at:Date.now(),value:data};
  return data;
}

const trophyCache=new Map();
export async function getPsnGameTrophies(id,service='trophy',force=false){
 if(!/^[a-zA-Z0-9_-]{4,100}$/.test(id))throw new Error('Ungültige Spielkennung');
 if(!['trophy','trophy2'].includes(service))throw new Error('Ungültiger Dienst');
 const key=service+':'+id,hit=trophyCache.get(key);
 if(!force&&hit&&Date.now()-hit.at<600000)return hit.data;
 const token=await accessToken();
 const root='https://m.np.playstation.com/api/trophy/v1/';
 const suffix='/npCommunicationIds/'+encodeURIComponent(id)+'/trophyGroups/all/trophies?npServiceName='+service+'&limit=100';
 // Sony's endpoint is paginated. Never silently omit DLC trophies after page one.
 const pages=async url=>{
  const collected=[],seen=new Set();
  for(let offset=0;offset<1000;offset+=100){
   const result=await psnGet(url+'&offset='+offset,token);
   const page=Array.isArray(result?.trophies)?result.trophies:[];
   let fresh=0;
   for(const trophy of page){
    const id=String(trophy?.trophyId??'');
    if(!id||seen.has(id))continue;
    seen.add(id);collected.push(trophy);fresh++;
   }
   if(page.length<100||fresh===0)break;
  }
  return collected;
 };
 const [catalog,progress,groupResponse]=await Promise.all([
  pages(root+suffix),
  pages(root+'users/me'+suffix),
  psnGet(root+'npCommunicationIds/'+encodeURIComponent(id)+'/trophyGroups?npServiceName='+service,token).catch(()=>null)
 ]);
 const groupNames=new Map((groupResponse?.trophyGroups||[]).map(g=>[String(g.trophyGroupId),g.trophyGroupName||g.trophyGroupDetail||'']));
 const earned=new Map(progress.map(t=>[t.trophyId,t]));
 const data=catalog.map(t=>({...t,
   trophyGroupName:groupNames.get(String(t.trophyGroupId||'default'))||null,
   earned:earned.get(t.trophyId)?.earned===true,
   earnedDateTime:earned.get(t.trophyId)?.earnedDateTime||null,
   trophyEarnedRate:earned.get(t.trophyId)?.trophyEarnedRate??t.trophyEarnedRate??null
 }));
 trophyCache.set(key,{at:Date.now(),data});return data;
}

const purchasedCache={at:0,value:null};
export async function getPsnDigitalLibrary(){
 if(purchasedCache.value&&Date.now()-purchasedCache.at<30*60*1000)return purchasedCache.value;
 const token=await accessToken();
 const items=[],seen=new Set(),size=50;
 let total=null,complete=false;
 for(let start=0;start<1000;start+=size){
  // Omit membership to include all active digital entitlements (including PS Plus).
  const variables={isActive:true,platform:['ps4','ps5'],size,start,sortBy:'ACTIVE_DATE',sortDirection:'desc'};
  const extensions={persistedQuery:{version:1,sha256Hash:'827a423f6a8ddca4107ac01395af2ec0eafd8396fc7fa204aaf9b7ed2eefa168'}};
  const url=new URL('https://web.np.playstation.com/api/graphql/v1/op');
  url.searchParams.set('operationName','getPurchasedGameList');
  url.searchParams.set('variables',JSON.stringify(variables));
  url.searchParams.set('extensions',JSON.stringify(extensions));
  let response;
  try{response=await psnGet(url.toString(),token,{'apollo-require-preflight':'true'})}catch(error){if(String(error?.message||'').includes('HTTP 400'))throw new Error('SONY_LIBRARY_HTTP_400: Sony lehnt den Bibliotheksabruf ab; die inoffizielle GraphQL-Abfrage kann sich ändern.');throw error}
  if(response.errors?.length){const messages=response.errors.map(e=>String(e?.message||''));throw new Error(messages.some(m=>/persistedquerynotfound|persisted.query.not.found/i.test(m))?'SONY_LIBRARY_QUERY_EXPIRED: Sony hat die gespeicherte Abfrage geändert.':'SONY_LIBRARY_GRAPHQL: Die PSN-Bibliotheksabfrage ist momentan nicht verfügbar.');}
  const result=response.data?.purchasedTitlesRetrieve;
  if(!Array.isArray(result?.games))throw new Error('Die Sony-Bibliothek liefert ein unbekanntes Datenformat.');
  const n=Number(result.pageInfo?.totalCount);
  if(Number.isFinite(n)&&n>=0)total=n;
  for(const game of result.games){
   const id=String(game.titleId||'');
   if(!id||seen.has(id))continue;
   seen.add(id);
   items.push({titleId:id,name:String(game.name||'Unbenannter Titel').slice(0,180)});
  }
  if(result.pageInfo?.isLast===true||result.games.length<size||total!==null&&start+result.games.length>=total){complete=true;break}
 }
 const data={titles:items,total,complete,source:'PSN digitale Berechtigungen',note:'Aktive digitale PS4/PS5-Berechtigungen; können Gratis- und PS-Plus-Titel enthalten. Keine Kaufquittungen oder Disc-Spiele.'};
 purchasedCache.at=Date.now();purchasedCache.value=data;
 return data;
}
