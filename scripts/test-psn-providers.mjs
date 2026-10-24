import test from 'node:test';
import assert from 'node:assert/strict';
import {getExternalGameSources} from '../lib/psn-extra-providers.mjs';

test('provider matching is exact and independently handles partial artwork',async()=>{
 const fetchBefore=globalThis.fetch,rawgBefore=process.env.RAWG_API_KEY,sgBefore=process.env.STEAMGRIDDB_API_KEY;
 process.env.RAWG_API_KEY='test-only';process.env.STEAMGRIDDB_API_KEY='test-only';
 const seen=[];
 globalThis.fetch=async (input,opts={})=>{
  const url=String(input);seen.push(url);
  const response=body=>({ok:true,json:async()=>body});
  if(url.includes('rawg.io/api/games?'))return response({results:[{name:'QA TEST GAME 8321',slug:'qa-test-game',metacritic:81,rating:4,genres:[{name:'Action'}],platforms:[{platform:{name:'PlayStation 5'}}],background_image:'https://media.rawg.io/media/games/test.jpg'}]});
  if(url.includes('rawg.io/api/games/'))return response({description_raw:'A verified sample game'});
  if(url.includes('/search/autocomplete/'))return response({data:[{id:123,name:'QA TEST GAME 8321'}]});
  if(url.includes('/heroes/game/'))return response({data:[{url:'https://cdn2.steamgriddb.com/hero/test.png'}]});
  if(url.includes('/grids/game/'))return response({data:[{url:'https://malicious.example/cover.jpg'}]});
  if(url.includes('/logos/game/'))throw Error('Temporary logo failure');
  throw Error('Unexpected HTTP request');
 };
 try{
  const result=await getExternalGameSources('QA TEST GAME 8321');
  assert.equal(result.rawg?.metacritic,81);
  assert.equal(result.rawg?.description,'A verified sample game');
  assert.equal(result.artwork?.hero,'https://cdn2.steamgriddb.com/hero/test.png');
  assert.equal(result.artwork?.cover,null);
  assert.equal(result.artwork?.logo,null);
  assert.equal(result.providers.rawg,'ready');
  assert.equal(result.providers.steamgriddb,'partial');
  assert.equal(seen.length,6);
 }finally{globalThis.fetch=fetchBefore;
  if(rawgBefore===undefined)delete process.env.RAWG_API_KEY;else process.env.RAWG_API_KEY=rawgBefore;
  if(sgBefore===undefined)delete process.env.STEAMGRIDDB_API_KEY;else process.env.STEAMGRIDDB_API_KEY=sgBefore;
 }
});

test('ambiguous title cannot silently receive a different edition',async()=>{
 const fetchBefore=globalThis.fetch,rawgBefore=process.env.RAWG_API_KEY,sgBefore=process.env.STEAMGRIDDB_API_KEY;
 process.env.RAWG_API_KEY='test-only';delete process.env.STEAMGRIDDB_API_KEY;
 globalThis.fetch=async()=>({ok:true,json:async()=>({results:[{name:'QA DELUXE 5822 Deluxe Edition',slug:'qa-deluxe-5822'}]})});
 try{
  const result=await getExternalGameSources('QA DELUXE 5822');
  assert.equal(result.rawg,null);
  assert.equal(result.providers.rawg,'no-match');
 }finally{globalThis.fetch=fetchBefore;
  if(rawgBefore===undefined)delete process.env.RAWG_API_KEY;else process.env.RAWG_API_KEY=rawgBefore;
  if(sgBefore===undefined)delete process.env.STEAMGRIDDB_API_KEY;else process.env.STEAMGRIDDB_API_KEY=sgBefore;
 }
});
