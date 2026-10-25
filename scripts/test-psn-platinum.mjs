import test from 'node:test';
import assert from 'node:assert/strict';
import {trophyTitleKey,trophySetCandidates,baseTrophy,platinumSummary} from '../lib/psn-platinum-plan.mjs';
import {getPsnGameTrophies} from '../lib/psn-server.mjs';

test('PSN trophy lists are matched conservatively without mixing editions',()=>{
 const played={titleId:'PPSA30000_00',name:'Assassin’s Creed Shadows'};
 const titles=[
  {npCommunicationId:'NPWR11111_00',trophyTitleName:"Assassin's Creed Shadows (PS5)",npServiceName:'trophy2'},
  {npCommunicationId:'NPWR22222_00',trophyTitleName:'Assassin’s Creed Shadows Deluxe Edition'},
  {npCommunicationId:'NPWR33333_00',trophyTitleName:'Another title',npTitleIds:['PPSA30000_00']}
 ];
 assert.equal(trophyTitleKey('Assassin’s Creed Shadows PS5'),trophyTitleKey("Assassin's Creed Shadows"));
 assert.deepEqual(trophySetCandidates(played,titles).map(t=>t.npCommunicationId),['NPWR11111_00','NPWR33333_00']);
 assert.equal(trophySetCandidates({name:'Assassin’s Creed Shadows Deluxe Edition'},titles).length,1);
});
test('real PSN progress differs from personal manually ticked goals and excludes DLC from base progress',()=>{
 const trophies=[
  {trophyId:1,trophyGroupId:'default',trophyType:'bronze',earned:true},
  {trophyId:2,trophyGroupId:'000',trophyType:'gold',earned:false},
  {trophyId:3,trophyGroupId:'001',trophyType:'silver',earned:false},
  {trophyId:4,trophyGroupId:'default',trophyType:'platinum',earned:false}
 ];
 const result=platinumSummary(trophies,['1','2','3'],['2','3']);
 assert.equal(result.baseTotal,2);
 assert.equal(result.baseEarned,1);
 assert.equal(result.remainingBase,1);
 assert.equal(result.targetsTotal,3);
 assert.equal(result.targetsPsnEarned,1);
 assert.equal(result.targetsManualDone,2);
 assert.equal(baseTrophy(trophies[2]),false);
});
test('PSN trophy catalog and own progress load beyond the first 100 trophies',async()=>{
 const prev=globalThis.fetch,old=process.env.PSN_NPSSO;
 process.env.PSN_NPSSO='B'.repeat(64);
 const queryCalls=[];
 const respond=value=>({ok:true,json:async()=>value});
 globalThis.fetch=async(input)=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/authorize'))return {headers:{get:n=>n==='location'?'https://example.org/ok?code=trophy-test':null}};
  if(url.pathname.endsWith('/token'))return respond({access_token:'test-token'});
  if(url.pathname.endsWith('/trophyGroups'))return respond({trophyGroups:[{trophyGroupId:'000',trophyGroupName:'Basisspiel'}]});
  const offset=Number(url.searchParams.get('offset')||0);
  const progress=url.pathname.includes('/users/me/');
  queryCalls.push({offset,progress});
  const count=offset?1:100;
  const trophies=Array.from({length:count},(_,i)=>({
   trophyId:offset+i,trophyGroupId:'000',trophyType:'bronze',trophyName:'Test '+(offset+i),
   ...(progress?{earned:offset+i<75,earnedDateTime:offset+i<75?'2026-10-20T12:00:00Z':null}:{})
  }));
  return respond({trophies});
 };
 try{
  const list=await getPsnGameTrophies('NPWR98765_00','trophy2');
  assert.equal(list.length,101);
  assert.equal(list.filter(t=>t.earned).length,75);
  assert.equal(list[100].trophyGroupName,'Basisspiel');
  assert.deepEqual(queryCalls.filter(x=>!x.progress).map(x=>x.offset),[0,100]);
  assert.deepEqual(queryCalls.filter(x=>x.progress).map(x=>x.offset),[0,100]);
 }finally{
  globalThis.fetch=prev;
  if(old===undefined)delete process.env.PSN_NPSSO;else process.env.PSN_NPSSO=old;
 }
});
