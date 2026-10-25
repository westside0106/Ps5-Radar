// Pure, dependency-free helpers shared by server routes and regression tests.
export function cloudHeaders(secret){
 return {
  apikey:secret,
  ...(secret.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+secret}),
  'Content-Type':'application/json'
 };
}
export function validCloudPayload(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return false;
 const objectOrEmpty=value=>value===undefined||value===null||(typeof value==='object'&&!Array.isArray(value));
 return ['notes','covers','coverUrls','trophyTargets','platinumChecks'].every(key=>objectOrEmpty(data[key]))
  &&(data.history===undefined||data.history===null||Array.isArray(data.history))
  &&(data.manualGames===undefined||data.manualGames===null||Array.isArray(data.manualGames))
  &&(data.collections===undefined||data.collections===null||Array.isArray(data.collections));
}
