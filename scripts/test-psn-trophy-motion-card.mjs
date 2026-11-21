import test from 'node:test';
import assert from 'node:assert/strict';
import {preferredVideoMime,cardVideoTitle,trophyVideoFacts,VIDEO_DURATION_MS,VIDEO_SIZE} from '../lib/psn-trophy-motion-card.mjs';

test('browser codecs are negotiated, not hardcoded as universally supported',()=>{
 assert.equal(preferredVideoMime(undefined),null);
 assert.equal(preferredVideoMime({isTypeSupported:()=>false}),null);
 const safari={isTypeSupported:x=>x==='video/mp4'};
 const chrome={isTypeSupported:x=>x==='video/webm;codecs=vp8'||x==='video/webm'};
 assert.equal(preferredVideoMime(safari),'video/mp4');
 assert.equal(preferredVideoMime(chrome),'video/webm;codecs=vp8');
 assert.equal(preferredVideoMime({isTypeSupported:x=>x.includes('avc1.42E01E')}),'video/mp4;codecs=avc1.42E01E');
});
test('video trophy facts never infer platinum from 100% progress',()=>{
 const a=trophyVideoFacts({trophyTitleName:'Sample',progress:100,earnedTrophies:{gold:4,bronze:6,platinum:0}});
 assert.equal(a.progress,100);assert.equal(a.platinum,false);assert.equal(a.count,10);
 const b=trophyVideoFacts({trophyTitleName:'Sample',progress:97,earnedTrophies:{platinum:1}});
 assert.equal(b.platinum,true);
 const c=trophyVideoFacts({progress:null,earnedTrophies:{}});
 assert.equal(c.progress,null);assert.equal(c.count,0);assert.equal(c.platinum,false);
});
test('invalid trophy progress and negative award counts never become visual facts',()=>{
 for(const input of [{progress:NaN,earnedTrophies:{platinum:-1}},{progress:150,earnedTrophies:{gold:Infinity}},{progress:'',earnedTrophies:{}}]){
  const row=trophyVideoFacts(input);assert.equal(row.progress,null);assert.equal(row.count,0);
 }
});
test('original card titles fit three bounded lines and avoid media imports',()=>{
 assert.deepEqual(cardVideoTitle('Cyberpunk 2077'),['Cyberpunk 2077']);
 const rows=cardVideoTitle('A very long game title that should not overlap the progress bar at the bottom of the collector card',20);
 assert.ok(rows.length<=3);assert.ok(rows.every(v=>v.length<=20));
 assert.deepEqual(cardVideoTitle('',20),['UNKNOWN GAME']);
});
test('video export has conservative size and short, finite duration',()=>{
 assert.deepEqual(VIDEO_SIZE,{width:720,height:960});
 assert.equal(VIDEO_DURATION_MS,4000);
});
