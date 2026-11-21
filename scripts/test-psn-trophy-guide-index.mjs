import test from 'node:test';
import assert from 'node:assert/strict';
import {
 externalTrophyGuideUrl,findTrophyGuideCandidates,lookupTrophyGuides,loadTrophyGuideIndex
} from '../lib/psn-trophy-guide-index.mjs';
import {trustedGuideUrl,normalizeGuideRecord} from '../lib/psn-trophy-guide-links.mjs';

const PSNP=1<<0,POWERPYX=1<<4,KNOEF=1<<1,PLATGET=1<<2,
 MISSABLE=1<<14,ONLINE=1<<15,PS5=1<<9,PS4=1<<8,TROPHY=1<<5,DLC=1<<6;
const fixture={
 '722-cyberpunk':{a:PSNP|TROPHY|PS5|MISSABLE,n:'Cyberpunk 2077 Trophy Guide & Roadmap',r:[5,2,75],g:[44],u:['Guide Author']},
 '730-cyberpunk-phantom-liberty':{a:PSNP|TROPHY|PS5|DLC,n:'Cyberpunk 2077 Phantom Liberty DLC Trophy Guide',r:[4,1,20]},
 'powerpyx-row':{a:POWERPYX|TROPHY|PS4|ONLINE,n:'Cyberpunk 2077 Trophy Guide',
   p:'cyberpunk-2077-trophy-guide-roadmap/',r:[6,1,100]},
 'fourth':{a:KNOEF|TROPHY|PS4,n:'God of War Ragnarok Trophy Guide',p:'god-of-war-ragnarok/',r:[3,1,70]},
 'fifth':{a:PLATGET|TROPHY|PS5,n:'Cyberpunk 2077 Trophy Roadmap',p:'cyberpunk-roadmap',r:[-1,-1,-1]},
 '__proto__':{a:PSNP|TROPHY,n:'Cyberpunk 2077 Trophy Guide',r:[5,1,50]},
 'malicious':{a:PSNP|TROPHY,n:'Cyberpunk 2077 Trophy Guide',p:'https://evil.example/',r:[5,1,50]},
 'hostSpoof':{a:POWERPYX|TROPHY,n:'Cyberpunk 2077 Trophy Guide',
   p:'//evil.example/steal',r:[5,1,50]}
};
test('title-linked candidates show source, difficulty, duration, platform and missable flags but never infer Sony NPWR IDs',()=>{
 const result=findTrophyGuideCandidates(fixture,'Cyberpunk 2077');
 assert.ok(result.length>=3);
 assert.equal(result[0].match,'title-guide');
 assert.ok(result.every(x=>!('npCommunicationId'in x)&&!('g'in x)));
 assert.ok(result.every(x=>x.url.startsWith('https://')));
 assert.ok(result.some(x=>x.source==='PSNProfiles'&&x.difficulty===5&&x.hours===75&&x.hasMissable));
 assert.ok(result.some(x=>x.source==='PowerPyx'&&x.hasOnline));
 assert.ok(result.some(x=>x.source==='PlatGet'&&x.hours===null&&x.difficulty===null));
 assert.ok(result.some(x=>x.match==='related-title'&&x.isDlc));
 assert.ok(result.every(x=>!x.url.includes('evil.example')));
 assert.equal(new Set(result.map(x=>x.url)).size,result.length);
});
test('matching uses title boundaries; it never assumes God of War equals God of War Ragnarok',()=>{
 const out=findTrophyGuideCandidates(fixture,'God of War');
 assert.equal(out.length,1);
 assert.equal(out[0].match,'related-title');
 assert.equal(out[0].title,'God of War Ragnarok Trophy Guide');
 assert.deepEqual(findTrophyGuideCandidates(fixture,'Assassin’s Creed Origins'),[]);
 assert.deepEqual(findTrophyGuideCandidates(fixture,'NPWR12345_00'),[]);
});
test('fixed source hosts and sanitized relative paths prevent remote redirection and path injection',()=>{
 assert.equal(externalTrophyGuideUrl('10-valid-id',{a:PSNP}), 'https://psnprofiles.com/guide/10-valid-id');
 assert.equal(externalTrophyGuideUrl('any-id',{a:POWERPYX,p:'cyberpunk-2077/'}),
  'https://www.powerpyx.com/cyberpunk-2077');
 assert.equal(externalTrophyGuideUrl('bad',{a:POWERPYX,p:'../a'}),null);
 assert.equal(externalTrophyGuideUrl('bad',{a:POWERPYX,p:'http://evil.com'}),null);
 assert.equal(externalTrophyGuideUrl('bad',{a:POWERPYX,p:'guide?token=secret'}),null);
 assert.equal(externalTrophyGuideUrl('bad',{a:POWERPYX,p:'%2e%2e/admin'}),null);
 assert.equal(externalTrophyGuideUrl('bad',{a:0}),null);
 assert.ok(trustedGuideUrl('https://www.platget.com/cyberpunk-roadmap'));
 assert.ok(trustedGuideUrl('https://knoef.info/guide'));
 assert.ok(trustedGuideUrl('https://www.trophy-tom.com/a'));
 assert.ok(trustedGuideUrl('https://videogamelizard.com/a'));
 assert.equal(trustedGuideUrl('https://platget.com.evil.org/a'),null);
 assert.equal(trustedGuideUrl('http://knoef.info/a'),null);
});
test('guide suggestions do not mutate personal notes or turn unflagged into confirmed not missable',()=>{
 const candidates=findTrophyGuideCandidates(fixture,'Cyberpunk 2077');
 assert.ok(candidates.every(x=>typeof x.hasMissable==='boolean'));
 const saved=normalizeGuideRecord({url:candidates[0].url,note:'personal',missable:'unknown',
  updatedAt:'2026-11-21T22:00:00Z'});
 assert.equal(saved.missable,'unknown');
 assert.equal(saved.note,'personal');
});
test('lookup exposes only source identity, data URL and bounded candidates, no raw records or account metadata',async()=>{
 let called=0;
 const result=await lookupTrophyGuides('Cyberpunk 2077',{loader:async()=>{called++;return fixture}});
 assert.equal(called,1);
 assert.equal(result.source,'langdonx/trophy-guide-list-json');
 assert.equal(result.sourceType,'third-party-index');
 assert.ok(result.matches.length<=8);
 assert.ok(!JSON.stringify(result).includes('Guide Author'));
 assert.ok(!JSON.stringify(result).includes('NPWR'));
 await assert.rejects(()=>lookupTrophyGuides('x',{loader:async()=>fixture}),/Invalid/);
});
test('invalid input, non-array records and unsafe guide values are rejected',()=>{
 assert.deepEqual(findTrophyGuideCandidates(null,'Cyberpunk 2077'),[]);
 assert.deepEqual(findTrophyGuideCandidates(fixture,'X'),[]);
 assert.deepEqual(findTrophyGuideCandidates(fixture,'A'.repeat(126)),[]);
 const extra={...fixture,unsafe:{a:'1',n:'Cyberpunk 2077 Trophy Guide',r:[10,1,10]}};
 assert.ok(!findTrophyGuideCandidates(extra,'Cyberpunk 2077').some(x=>x.url.includes('unsafe')));
});
test('on-demand upstream lookup is bounded to a fixed public index; no client data or account identifiers transmitted',async()=>{
 const records=Object.fromEntries(Array.from({length:101},(_,i)=>[
  'x-'+i,{a:PSNP|TROPHY,n:'Test Game Trophy Guide',r:[2,1,12]}
 ]));
 const urls=[];
 const data=await loadTrophyGuideIndex({
  now:()=>Date.now(),
  fetcher:async(url,init)=>{
   urls.push(url);
   assert.equal(init.headers.Accept,'application/json');
   assert.ok(!url.includes('NPWR'));
   assert.ok(!url.includes('Test Game'));
   return {ok:true,headers:{get:()=>String(JSON.stringify(records).length)},
    text:async()=>JSON.stringify(records)};
  }
 });
 assert.equal(Object.keys(data).length,101);
 assert.equal(urls.length,1);
});
