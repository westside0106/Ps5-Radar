import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { emptyCatalog, normalizeCatalog, catalogCover, catalogFilter, mergeCatalogSnapshots, berlinDate, titleKey } from '../lib/ps-plus-catalog.mjs';
import { safePlusCover, dailyLabel } from '../lib/radar-media.mjs';
import { CATALOG_TABS, prepareCatalog, catalogFilter as catalogViewFilter } from '../lib/radar-catalog-view.mjs';
import { berlinDay, monthlyClaimEnd, currentEssential } from '../lib/ps-plus-current.mjs';
import { storeProduct, verifiedStoreCover } from './lib/media-identity.mjs';
const source='https://www.playstation.com/de-de/ps-plus/games/';
const store='https://store.playstation.com/de-de/product/EP0000-PPSA00000_00-GAME000000000000';
const cover='https://image.api.playstation.com/vulcan/ap/rnd/202609/0101/cover.png';
const item={title:'Testspiel',storeUrl:store,image:cover,platforms:['PS5']};
const fixture=()=>normalizeCatalog({checkedAt:'2026-09-07T08:00:00Z',sourceUrl:source,results:{extra:{expected:1,complete:true,entries:[item]},essential:{expected:0,complete:true,entries:[]},classics:{expected:0,complete:true,entries:[]},ubisoft:{expected:0,complete:true,entries:[]}}});
test('catalog completeness rejects partial and invalid results',()=>{
 const c=normalizeCatalog({results:{extra:{expected:2,complete:true,entries:[item]}}});
 assert.equal(c.sections.extra.complete,false);assert.equal(c.games.length,1);
 assert.equal(normalizeCatalog({results:{extra:{expected:1,complete:false,entries:[item]}}}).sections.extra.complete,false);
});
test('media identity never accepts a generic announcement or unrelated edition',()=>{
 const c=fixture();
 assert.equal(catalogCover(c,'Testspiel',store),cover);
 assert.equal(catalogCover(c,'Anderes Spiel',store),null);
 assert.equal(catalogCover(c,'Testspiel','https://store.playstation.com/de-de/product/OTHER'),null);
 assert.equal(safePlusCover({title:'Testspiel',image:'https://blog.de.playstation.com/announcement.jpg'}, {}, emptyCatalog()),null);
 assert.equal(safePlusCover({title:'Testspiel',storeUrl:store},{gameDetails:{Testspiel:{storeUrl:store,coverImage:cover}}},emptyCatalog()),cover);
});
test('store product identity is proven by sku, not by a matching image domain',()=>{
 const sku='UP4363-PPSA17232_00-SNIPERELITERES00';
 const art='https://image.api.playstation.com/vulcan/ap/rnd/202408/1309/cover.png';
 const page=extra=>`<html><head><script type="application/ld+json">${JSON.stringify({'@context':'http://schema.org','@type':'Product',name:'Sniper Elite: Resistance PS4™ & PS5™',sku,image:art,...extra})}</script></head></html>`;
 const url=`https://store.playstation.com/de-de/product/${sku}`;
 assert.deepEqual(storeProduct(page({})),{sku,name:'Sniper Elite: Resistance PS4™ & PS5™',image:art});
 assert.equal(verifiedStoreCover({title:'Sniper Elite: Resistance',storeUrl:url,html:page({})}),art);
 assert.equal(verifiedStoreCover({title:'Sniper Elite: Resistance',storeUrl:'https://store.playstation.com/de-de/product/EP0900-CUSA29547_00-4103461541053748',html:page({})}),null);
 assert.equal(verifiedStoreCover({title:'Chained Echoes',storeUrl:url,html:page({})}),null);
 assert.equal(verifiedStoreCover({title:'Sniper Elite: Resistance',storeUrl:url,html:page({image:'https://blog.de.playstation.com/announcement.jpg'})}),null);
 assert.equal(storeProduct('<html><head></head></html>'),null);
 assert.equal(verifiedStoreCover({title:'Sniper Elite: Resistance',storeUrl:url,html:'<html></html>'}),null);
});
test('trademark symbols never leak into the normalized title',()=>{
 assert.equal(titleKey('MLB® The Show™ 26'),'mlb the show 26');
 assert.equal(titleKey('Sniper Elite: Resistance PS4™ & PS5™'),'sniper elite resistance ps4 and ps5');
 const sku='UP9000-PPSA30630_00-MLBTHESHOW26SHIP';
 const art='https://image.api.playstation.com/vulcan/ap/rnd/202607/0816/cover.png';
 const html=`<html><head><script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'MLB® The Show™ 26',sku,image:art})}</script></head></html>`;
 assert.equal(verifiedStoreCover({title:'MLB The Show 26',storeUrl:`https://store.playstation.com/de-de/product/${sku}`,html}),art);
});
test('source-side duplicates do not make a fully paginated section incomplete',()=>{
 const a={title:'Spiel A',storeUrl:'https://store.playstation.com/de-de/product/EP0000-PPSA00001_00-AAAAAAAAAAAAAAAA',image:cover,platforms:['PS5']};
 const b={title:'Spiel B',storeUrl:'https://store.playstation.com/de-de/product/EP0000-PPSA00002_00-BBBBBBBBBBBBBBBB',image:cover,platforms:['PS5']};
 const c=normalizeCatalog({results:{extra:{expected:3,observed:3,complete:true,entries:[a,b,{...a}]}}});
 assert.equal(c.sections.extra.complete,true);assert.equal(c.sections.extra.count,2);assert.equal(c.sections.extra.duplicates,1);
 const partial=normalizeCatalog({results:{extra:{expected:3,observed:2,complete:true,entries:[a,b]}}});
 assert.equal(partial.sections.extra.complete,false);
});
test('catalog tiles bring their own copy and never get the magazine overlay',async()=>{
 const detail=await fs.readFile(new URL('../app/radar/DetailTile.jsx',import.meta.url),'utf8');
 const client=await fs.readFile(new URL('../app/ps-plus/CatalogClient.jsx',import.meta.url),'utf8');
 const expression=detail.match(/const isPlusCard = ([^;]+);/)[1];
 const isPlusCard=value=>new Function('detail',`return ${expression};`)(value);
 assert.equal(isPlusCard({kind:'catalog-game',kicker:'EXTRA',image:'cover.png'}),false);
 assert.equal(isPlusCard({kind:'catalog-game',kicker:'PLAYSTATION PLUS',image:'cover.png'}),false);
 assert.equal(isPlusCard({kind:'game',kicker:'PLAYSTATION PLUS',image:'cover.png'}),true);
 assert.match(client,/kind: 'catalog-game'/);
 assert.ok(!/Plattform nicht angegeben/.test(client),'Platzhaltertext darf nicht mehr vorkommen');
 assert.match(client,/\{platforms \? <p>\{platforms\}<\/p> : null\}/);
});
test('a partial run never erases genres or platforms captured earlier',()=>{
 const url='https://store.playstation.com/de-de/product/EP0000-PPSA00000_00-GAME000000000000';
 const withTags={title:'Testspiel',storeUrl:url,image:cover,platforms:['PS5'],genres:['Action']};
 const withoutTags={title:'Testspiel',storeUrl:url,image:cover};
 const full=normalizeCatalog({checkedAt:'2026-09-11T08:00:00Z',results:{extra:{expected:1,observed:1,complete:true,entries:[withTags]}}});
 const partial=normalizeCatalog({checkedAt:'2026-09-14T08:00:00Z',results:{extra:{expected:1,observed:1,complete:true,entries:[withoutTags]}}});
 const merged=mergeCatalogSnapshots(full,partial);
 assert.deepEqual(merged.games[0].platforms,['PS5'],'Plattform darf nicht verlorengehen');
 assert.deepEqual(merged.games[0].genres,['Action'],'Genre darf nicht verlorengehen');
 const better={title:'Testspiel',storeUrl:url,image:cover,platforms:['PS4','PS5'],genres:['Action','Puzzle']};
 const neu=normalizeCatalog({checkedAt:'2026-09-14T08:00:00Z',results:{extra:{expected:1,observed:1,complete:true,entries:[better]}}});
 assert.deepEqual(mergeCatalogSnapshots(full,neu).games[0].genres,['Action','Puzzle']);
});
test('catalog membership is not confused with a monthly claim',()=>{
 const c=fixture();const radar={plusGames:[{title:'Testspiel',storeUrl:store}],psplusText:'01.09.–05.10.2026'};
 const view=prepareCatalog(c,radar,new Date('2026-09-07T12:00:00Z'));
 assert.equal(view.games.length,1);assert.deepEqual(view.games[0].services,['extra']);
 assert.equal(view.sections.extra.complete,true);
 assert.deepEqual(CATALOG_TABS.map(tab=>tab.id),['essential','extra','premium','ubisoft']);
 assert.equal(view.sections.trials,undefined);assert.equal(view.sections.leaving,undefined);
});
test('PS+ sorting uses available metadata with deterministic fallback',()=>{
 const games=[
  {id:'a',title:'Alpha',services:['extra'],genres:['Action'],platforms:['PS4'],image:null,releaseDate:'2024-05-01'},
  {id:'b',title:'Beta',services:['extra'],genres:['Puzzle'],platforms:['PS5'],image:cover,releaseDate:'2025-05-01'},
  {id:'c',title:'Charlie',services:['extra'],genres:[],platforms:['PS4','PS5'],image:null},
  {id:'d',title:'Delta',services:['extra'],genres:['Adventure'],platforms:['PS4'],image:cover,releaseDate:'2023-05-01'}
 ];
 const ids=sort=>catalogViewFilter(games,{service:'extra',sort}).map(game=>game.id).join(',');
 assert.equal(ids('title-desc'),'d,c,b,a');
 assert.equal(ids('genre'),'a,d,b,c');
 assert.equal(ids('genre-desc'),'b,d,a,c');
 assert.equal(ids('ps5-first'),'b,c,a,d');
 assert.equal(ids('ps4-first'),'a,c,d,b');
 assert.equal(ids('cover-first'),'b,d,a,c');
 assert.equal(ids('cover-last'),'a,c,b,d');
 assert.equal(ids('release-new'),'b,a,d,c');
 assert.equal(ids('release-old'),'d,a,b,c');
});
test('expired monthly PS+ editorial yields to recent verified Essential catalog',()=>{
 const radar={psplusLabel:'SEPTEMBER 2026',psplusTitle:'September-Spiele sind live',psplusText:'Verfügbar bis 05.10.',plusGames:[{title:'Altes Spiel'}]};
 const catalog={checkedAt:'2026-10-11T10:00:00Z',sourceUrl:'https://www.playstation.com/de-de/ps-plus/games/',sections:{essential:{complete:true}},games:[
  {title:'Aktuelles Spiel',storeUrl:'https://store.playstation.com/de-de/concept/123',services:['essential'],image:'https://image.api.playstation.com/abc.png'},
  {title:'Extra-Spiel',storeUrl:'https://store.playstation.com/de-de/concept/456',services:['extra']}
 ]};
 assert.equal(monthlyClaimEnd(radar),'2026-10-05');
 assert.equal(berlinDay(new Date('2026-10-11T22:30:00Z')),'2026-10-12');
 const current=currentEssential(radar,catalog,new Date('2026-10-12T01:00:00Z'));
 assert.equal(current.kind,'catalog');
 assert.deepEqual(current.games.map(game=>game.title),['Aktuelles Spiel']);
 assert.match(current.text,/Beanspruchungsfrist.*nicht bestätigt/i);
 assert.equal(current.sourceUrl,catalog.sourceUrl);
 assert.equal(currentEssential(radar,catalog,new Date('2026-10-03T12:00:00Z')).kind,'monthly');
 const tooOld={...catalog,checkedAt:'2026-09-01T10:00:00Z'};
 assert.equal(currentEssential(radar,tooOld,new Date('2026-10-12T01:00:00Z')).kind,'unverified');
 assert.equal(currentEssential(radar,{...catalog,sections:{essential:{complete:false}}},new Date('2026-10-12T01:00:00Z')).games.length,0);
 assert.equal(monthlyClaimEnd({psplusLabel:'DEZEMBER 2026',psplusText:'Verfügbar bis 05.01.'}),'2027-01-05');
});
test('failed refresh preserves last valid snapshot and does not invent games',()=>{
 const old=fixture();const next=normalizeCatalog({checkedAt:'2026-09-08T08:00:00Z',results:{extra:{expected:5,complete:false,entries:[]}}});
 const merged=mergeCatalogSnapshots(old,next);assert.equal(merged.games.length,1);assert.equal(merged.sections.extra.complete,true);
});
test('Berlin calendar date and today labels are exact',()=>{
 assert.equal(berlinDate(new Date('2026-09-06T22:30:00Z')),'2026-09-07');
 assert.equal(dailyLabel('06.09.2026','07.09.2026'),'SEIT 06.09.');
 assert.equal(dailyLabel('07.09.2026','07.09.2026'),'HEUTE NEU');
});
test('internal leaving filter still requires confirmed future dates',()=>{
 const games=[{id:'1',title:'A',services:['extra'],leavingAt:'2026-09-08'},{id:'2',title:'B',services:['extra']},{id:'3',title:'C',services:['extra'],leavingAt:'2026-09-06'}];
 assert.deepEqual(catalogFilter(games,{service:'leaving',now:new Date('2026-09-07T12:00:00Z')}).map(g=>g.id),['1']);
});
test('prices and signals occupy separate DOM and layout regions',async()=>{
 const page=await fs.readFile(new URL('../app/radar/page.jsx',import.meta.url),'utf8');
 const detail=await fs.readFile(new URL('../app/radar/DetailTile.jsx',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../app/radar-goal.css',import.meta.url),'utf8');
 assert.match(page,/className="deal-price-values"/);assert.match(detail,/className="radar-signal-footer"/);
 assert.match(css,/\.radar-signal-footer\s*\{[^}]*position:relative/);assert.match(css,/\.deal-showcase-price\s*\{[^}]*display:flex/);
 assert.match(page,/Alle PS\+-Spiele anzeigen/);
});
test('video review goal removes empty navigation and dead magazine space',async()=>{
 const client=await fs.readFile(new URL('../app/ps-plus/CatalogClient.jsx',import.meta.url),'utf8');
 const goalCss=await fs.readFile(new URL('../app/video-review-goal.css',import.meta.url),'utf8');
 const sanitizer=await fs.readFile(new URL('./sanitize-radar.mjs',import.meta.url),'utf8');
 const editorial=await fs.readFile(new URL('./refresh-editorial.mjs',import.meta.url),'utf8');
 assert.ok(!CATALOG_TABS.some(tab=>['trials','leaving'].includes(tab.id)));
 assert.ok(!/service==='trials'|service==='leaving'/.test(client));
 assert.match(client,/eindeutige erfasste Titel/);
 assert.match(goalCss,/release-showcase:has\(\.release-grid:empty\)\{display:none\}/);
 assert.match(goalCss,/deal-count-2/);
 assert.match(sanitizer,/&#8220;\|&#8221;/);
 assert.match(sanitizer,/Aktuelle Store-Aktion endet bald/);
 assert.match(editorial,/pageHero/);
 assert.match(editorial,/type:'editorial'/);
});
test('iphone login and Daily PNG stay stable and clean',async()=>{
 const login=await fs.readFile(new URL('../app/page.jsx',import.meta.url),'utf8');
 const globals=await fs.readFile(new URL('../app/globals.css',import.meta.url),'utf8');
 const screenshot=await fs.readFile(new URL('./screenshot-radar.mjs',import.meta.url),'utf8');
 const workflow=await fs.readFile(new URL('../.github/workflows/daily-radar.yml',import.meta.url),'utf8');
 const page=await fs.readFile(new URL('../app/radar/page.jsx',import.meta.url),'utf8');
 assert.ok(!/autoFocus/.test(login),'Login darf auf iPhone nicht ungefragt fokussieren');
 assert.match(globals,/\.login-card input\{[^}]*font-size:16px/);
 assert.match(screenshot,/nextjs-portal/);
 assert.match(screenshot,/watchlist-dock/);
 assert.match(screenshot,/copyFile\(latest, numbered\)/);
 assert.match(screenshot,/readdir\(outDir\)/);
 assert.match(screenshot,/fs\.rm\(path\.join\(outDir, entry\)/);
 assert.ok(!/fs\.access\(numbered\)/.test(screenshot),'Aktuelle nummerierte Ausgabe muss mit latest synchronisiert werden');
 assert.match(workflow,/npm run build/);
 assert.match(workflow,/npm run start -- --hostname 127\.0\.0\.1/);
 assert.match(workflow,/git add[^\n]*data\/daily\//);
 assert.match(page,/deal-count-\$\{Math\.min\(radar\.deals\.length, 3\)\}/);
 const vercel=JSON.parse(await fs.readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.match(vercel.ignoreCommand,/VERCEL_GIT_COMMIT_REF/);
 assert.match(vercel.ignoreCommand,/main/);
});

test('catalog route requires the existing private session',async()=>{
 const page=await fs.readFile(new URL('../app/ps-plus/page.jsx',import.meta.url),'utf8');
 assert.match(page,/safeEqual\(jar\.get\(COOKIE_NAME\)\?\.value, expected\)/);
 assert.match(page,/redirect\('\/'\)/);
});

test('magazine defines Essential and quick links inside RadarPage render scope', async () => {
 const page=await fs.readFile(new URL('../app/radar/page.jsx',import.meta.url),'utf8');
 const dealStart=page.indexOf('function dealStats(deal) {');
 const dealEnd=page.indexOf('function shortPsPlus(',dealStart);
 const renderStart=page.indexOf('export default async function RadarPage() {');
 const renderEnd=page.indexOf('  return (',renderStart);
 assert.ok(dealStart>=0 && dealEnd>dealStart && renderStart>dealEnd && renderEnd>renderStart);
 const dealBody=page.slice(dealStart,dealEnd);
 const renderSetup=page.slice(renderStart,renderEnd);
 assert.doesNotMatch(dealBody,/\bconst (?:essential|quickItems)\s*=/,
  'Essential state must not be nested inside the unrelated dealStats helper');
 assert.match(renderSetup,/const essential\s*=\s*currentEssential\(radar, catalog\)/,
  'Essential must be defined in the server-render scope');
 assert.match(renderSetup,/const quickItems\s*=\s*\(radar\.quickItems/,
  'Quick links must be defined in the server-render scope');
});

test('verified catalog changes produce sortable additions and removals without false positives',()=>{
 const old=fixture();
 const extra={...item,title:'Zweiter Titel',storeUrl:'https://store.playstation.com/de-de/product/EP0000-PPSA00001_00-GAME000000000001'};
 const next=normalizeCatalog({checkedAt:'2026-09-08T08:00:00Z',sourceUrl:source,results:{
  extra:{expected:1,observed:1,complete:true,entries:[extra]},
  essential:{expected:0,observed:0,complete:true,entries:[]},
  classics:{expected:0,observed:0,complete:true,entries:[]},
  ubisoft:{expected:0,observed:0,complete:true,entries:[]}
 }});
 const merged=mergeCatalogSnapshots(old,next);
 assert.deepEqual(merged.changes.map(c=>c.kind).sort(),['added','removed']);
 assert.deepEqual(merged.games.map(g=>g.title),['Zweiter Titel']);
 const prepared=prepareCatalog(merged,{plusGames:[],gameDetails:{}});
 assert.equal(prepared.games[0].addedAt,'2026-09-08T08:00:00Z');
 const failed=normalizeCatalog({checkedAt:'2026-09-09T08:00:00Z',results:{extra:{expected:2,observed:0,complete:false,entries:[]}}});
 const preserved=mergeCatalogSnapshots(merged,failed);
 assert.equal(preserved.changes.length,2);
 assert.equal(preserved.games.length,1);
});
