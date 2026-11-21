// Server-only Twitch app-token manager. One hot instance may serve many PSN pages.
// Prevent repeated credential-rejection requests while retaining catalog fallbacks.
export const IGDB_OAUTH_COOLDOWNS_MS=Object.freeze({
 unauthorized:30*60*1000,
 rateLimited:5*60*1000,
 transient:60*1000
});

export function createIgdbAppTokenReader({fetcher=fetch,clock=Date.now}={}){
 let credentials=null,token=null,blockedUntil=0,pending=null;
 const backoffFor=status=>(status===401||status===403)
  ?IGDB_OAUTH_COOLDOWNS_MS.unauthorized
  :status===429?IGDB_OAUTH_COOLDOWNS_MS.rateLimited
  :IGDB_OAUTH_COOLDOWNS_MS.transient;

 return async function igdbAppToken(clientId,clientSecret){
  if(!clientId||!clientSecret)return null;
  // Configuration may change in tests or a long-running process. Never reuse
  // a token or a negative cache from a different app or secret.
  if(!credentials||credentials.clientId!==clientId||credentials.clientSecret!==clientSecret){
   credentials={clientId,clientSecret};
   token=null;blockedUntil=0;pending=null;
  }
  const now=clock();
  if(token?.until>now)return token.value;
  if(blockedUntil>now)return null;
  if(pending)return pending;
  pending=(async()=>{
   let status=0;
   try{
    const response=await fetcher('https://id.twitch.tv/oauth2/token',{
     method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
     body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'client_credentials'}),
     cache:'no-store',signal:AbortSignal.timeout(5500)
    });
    status=response.status;
    if(!response.ok)throw new Error('IGDB OAuth '+status);
    const payload=await response.json();
    if(typeof payload?.access_token!=='string'||!payload.access_token)
     throw new Error('IGDB OAuth invalid token response');
    const validFor=Number(payload.expires_in);
    const timeMs=Number.isFinite(validFor)&&validFor>0
     ?Math.min(24*3600*1000,Math.max(1000,(validFor>300?validFor-300:validFor/2)*1000))
     :55*60*1000;
    token={value:payload.access_token,until:clock()+timeMs};
    blockedUntil=0;
    return token.value;
   }catch(error){
    token=null;
    blockedUntil=clock()+backoffFor(status);
    // Provider replies / network errors must never reach the log (tokens may
    // appear in their bodies). Only a fixed error category or HTTP code does.
    if(status&&!String(error?.message||'').startsWith('IGDB OAuth invalid'))
     throw new Error('IGDB OAuth '+status);
    if(status)throw new Error('IGDB OAuth invalid token response');
    throw new Error('IGDB OAuth network or response failure');
   }finally{pending=null}
  })();
  return pending;
 };
}
