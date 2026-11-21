import test from 'node:test';
import assert from 'node:assert/strict';
import {createIgdbAppTokenReader,IGDB_OAUTH_COOLDOWNS_MS} from '../lib/igdb-oauth-server.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{status});
test('403 rejections are negative-cached for 30 minutes; catalog callers receive null until retry',async()=>{
 let at=Date.parse('2026-11-21T04:00:00Z'),calls=0;
 const read=createIgdbAppTokenReader({clock:()=>at,fetcher:async()=>{calls++;return calls===1?reply({message:'secret must never leak'},403):reply({access_token:'live-token',expires_in:3600})}});
 await assert.rejects(()=>read('client','secret'),e=>e.message==='IGDB OAuth 403');
 for(let i=0;i<6;i++)assert.equal(await read('client','secret'),null);
 assert.equal(calls,1,'Repeated 403 failures must not hammer Twitch');
 at+=IGDB_OAUTH_COOLDOWNS_MS.unauthorized-1;
 assert.equal(await read('client','secret'),null);
 at+=1;
 assert.equal(await read('client','secret'),'live-token');
 assert.equal(calls,2);
 assert.equal(await read('client','secret'),'live-token');
 assert.equal(calls,2,'Successful token is cached until its safe expiration');
});
test('429 and network errors use shorter, bounded backoff',async()=>{
 let now=5000000,calls=0;
 const fetcher=async()=>{calls++;return calls===1?reply({},429):reply({access_token:'okay',expires_in:1000})};
 const read=createIgdbAppTokenReader({clock:()=>now,fetcher});
 await assert.rejects(()=>read('app','secret'),/IGDB OAuth 429/);
 assert.equal(await read('app','secret'),null);
 now+=IGDB_OAUTH_COOLDOWNS_MS.rateLimited;
 assert.equal(await read('app','secret'),'okay');
 assert.equal(calls,2);
 let attempts=0;
 const network=createIgdbAppTokenReader({clock:()=>now,fetcher:async()=>{attempts++;throw Error('sensitive-provider-response raw secret')}});
 await assert.rejects(()=>network('app','secret'),e=>e.message==='IGDB OAuth network or response failure');
 assert.equal(await network('app','secret'),null);
 assert.equal(attempts,1);
 now+=IGDB_OAUTH_COOLDOWNS_MS.transient;
 await assert.rejects(()=>network('app','secret'),/network or response failure/);
 assert.equal(attempts,2);
});
test('two simultaneous calls share one Twitch OAuth exchange',async()=>{
 let calls=0;
 const read=createIgdbAppTokenReader({fetcher:async()=>{
  calls++;await new Promise(resolve=>setTimeout(resolve,10));
  return reply({access_token:'same-token',expires_in:3600});
 }});
 const tokens=await Promise.all([read('client','secret'),read('client','secret'),read('client','secret')]);
 assert.deepEqual(tokens,['same-token','same-token','same-token']);
 assert.equal(calls,1);
});
test('rotated credentials clear rejected token backoff immediately',async()=>{
 let calls=0;
 const read=createIgdbAppTokenReader({fetcher:async(_url,opts)=>{
  calls++;
  const secret=new URLSearchParams(opts.body).get('client_secret');
  return secret==='old'?reply({},403):reply({access_token:'new-token',expires_in:3600});
 }});
 await assert.rejects(()=>read('app','old'),/403/);
 assert.equal(await read('app','old'),null);
 assert.equal(await read('app','new'),'new-token');
 assert.equal(calls,2);
});
test('bad successful HTTP body must not leak credentials or raw data',async()=>{
 let calls=0;
 const read=createIgdbAppTokenReader({fetcher:async()=>{calls++;return reply({access_token:null,secret:'do not show'});}});
 await assert.rejects(()=>read('client','secret'),e=>e.message==='IGDB OAuth invalid token response');
 assert.equal(await read('client','secret'),null);
 assert.equal(calls,1);
});
