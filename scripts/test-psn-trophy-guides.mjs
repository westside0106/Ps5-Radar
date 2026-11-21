import test from 'node:test';
import assert from 'node:assert/strict';
import {trustedGuideUrl,normalizeGuideRecord,normalizeTrophyGuides,mergeTrophyGuides,trophyGuideSearches,TROPHY_GUIDES_KEY} from '../lib/psn-trophy-guide-links.mjs';
import {validCloudPayload} from '../lib/psn-cloud-helpers.mjs';

test('known external guides only: force TLS and reject secret-bearing or spoofed hosts',()=>{
 assert.equal(trustedGuideUrl('http://powerpyx.com/cyberpunk'),null);
 for(const url of ['javascript:alert(1)','http://powerpyx.com/guide','https://powerpyx.com.evil.org/guide','https://user:pass@psnprofiles.com/guide','https://localhost:443/','https://powerpyx.com:9443/a','https://reddit.com/guide','file:///etc/passwd'])
  assert.equal(trustedGuideUrl(url),null,'rejected '+url);
 assert.equal(trustedGuideUrl('https://www.powerpyx.com/trophy-guide/#comments'),'https://www.powerpyx.com/trophy-guide/');
 assert.equal(trustedGuideUrl('https://psnprofiles.com/guide/123'),'https://psnprofiles.com/guide/123');
 assert.equal(trustedGuideUrl('https://www.truetrophies.com/guide'), 'https://www.truetrophies.com/guide');
});
test('normalizes user annotations, safe URL, bounded notes and stable Sony trophy set keys',()=>{
 const raw={NPWR12345_00:{url:'https://psnprofiles.com/guide/1',note:' memo ',missable:'yes',updatedAt:'2026-11-21T00:00:00Z'},
  'bad key':{url:'https://powerpyx.com/'},NPWR12346_00:{url:'https://evil.org',note:'A'.repeat(900),missable:'bogus'}};
 const rows=normalizeTrophyGuides(raw);
 assert.equal(Object.keys(rows).length,2);
 assert.equal(rows.NPWR12345_00.note,'memo');
 assert.equal(rows.NPWR12346_00.note.length,400);
 assert.equal(rows.NPWR12346_00.missable,'unknown');
 assert.equal(rows.NPWR12346_00.url,'');
 assert.equal(normalizeGuideRecord({url:'https://evil.org',note:'',missable:'unknown'}),null);
});
test('rejects prototype pollution and arbitrary/non-Sony trophy set identifiers',()=>{
 const untrusted=JSON.parse('{"__proto__":{"url":"https://www.powerpyx.com/guide"},"constructor":{"note":"bad"},"NPWR54321_00":{"note":"valid"}}');
 const clean=normalizeTrophyGuides(untrusted);
 assert.equal(Object.keys(clean).length,1);
 assert.equal(clean.NPWR54321_00.note,'valid');
 assert.equal(({}).url,undefined);
 assert.equal(Object.getPrototypeOf(clean),null);
});
test('merges imports and cloud backups without discarding newer local guide edits',()=>{
 const a={NPWR10001_00:{url:'https://psnprofiles.com/guide/a',note:'local newer',missable:'no',updatedAt:'2026-11-21T12:00:00Z'}};
 const b={NPWR10001_00:{url:'https://www.powerpyx.com/x',note:'remote older',missable:'yes',updatedAt:'2026-11-20T12:00:00Z'},
 NPWR10002_00:{url:'https://www.powerpyx.com/y',note:'new',missable:'unknown',updatedAt:'2026-11-21T12:00:00Z'}};
 const m=mergeTrophyGuides(a,b);
 assert.equal(m.NPWR10001_00.note,'local newer');
 assert.equal(m.NPWR10002_00.note,'new');
 assert.equal(mergeTrophyGuides(m,{NPWR10001_00:{...b.NPWR10001_00,updatedAt:'2026-11-22T12:00:00Z'}}).NPWR10001_00.note,'remote older');
});
test('search links are external discovery, not fabricated game-specific guide URLs',()=>{
 const searches=trophyGuideSearches('Cyberpunk 2077');
 assert.equal(searches.length,4);
 assert.ok(searches.every(x=>x.url.startsWith('https://www.google.com/search?')));
 const q=new URL(searches[0].url).searchParams.get('q');
 assert.ok(q.includes('site:psnprofiles.com'));
 assert.ok(q.includes('Cyberpunk 2077'));
 assert.deepEqual(trophyGuideSearches(''),[]);
 assert.equal(TROPHY_GUIDES_KEY,'psn-trophy-guides-v1');
});
test('existing cloud payload contract supports guide objects, rejects malformed collections',()=>{
 assert.equal(validCloudPayload({notes:{},trophyGuides:{}}),true);
 assert.equal(validCloudPayload({trophyGuides:[]}),false);
});
