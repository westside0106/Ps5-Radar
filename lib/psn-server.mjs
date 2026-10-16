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
async function psnGet(url,token) {
  return jsonResponse(await fetch(url,{headers:{Authorization:'Bearer '+token,'Accept-Language':'de-DE'},cache:'no-store',signal:AbortSignal.timeout(12000)}));
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
  if (!data.summary && !data.trophies && !data.played) throw new Error('PSN-Daten konnten nicht geladen werden: '+data.errors.join('; '));
  cache={at:Date.now(),value:data};
  return data;
}

const trophyCache=new Map();
export async function getPsnGameTrophies(id,service='trophy'){
 if(!/^[a-zA-Z0-9_-]{4,100}$/.test(id))throw new Error('Ungültige Spielkennung');
 if(!['trophy','trophy2'].includes(service))throw new Error('Ungültiger Dienst');
 const key=service+':'+id,hit=trophyCache.get(key);
 if(hit&&Date.now()-hit.at<600000)return hit.data;
 const token=await accessToken();
 const root='https://m.np.playstation.com/api/trophy/v1/';
 const suffix='/npCommunicationIds/'+encodeURIComponent(id)+'/trophyGroups/all/trophies?npServiceName='+service+'&limit=100';
 const [catalog,progress,groupResponse]=await Promise.all([
   psnGet(root+suffix,token),
   psnGet(root+'users/me'+suffix,token),
   psnGet(root+'npCommunicationIds/'+encodeURIComponent(id)+'/trophyGroups?npServiceName='+service,token).catch(()=>null)
 ]);
 const groupNames=new Map((groupResponse?.trophyGroups||[]).map(g=>[String(g.trophyGroupId),g.trophyGroupName||g.trophyGroupDetail||'']));
 const earned=new Map((progress.trophies||[]).map(t=>[t.trophyId,t]));
 const data=(catalog.trophies||[]).map(t=>({...t,
   trophyGroupName:groupNames.get(String(t.trophyGroupId||'default'))||null,
   earned:earned.get(t.trophyId)?.earned===true,
   earnedDateTime:earned.get(t.trophyId)?.earnedDateTime||null,
   trophyEarnedRate:earned.get(t.trophyId)?.trophyEarnedRate??t.trophyEarnedRate??null
 }));
 trophyCache.set(key,{at:Date.now(),data});return data;
}
