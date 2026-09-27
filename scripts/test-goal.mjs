import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { emptyCatalog, normalizeCatalog, catalogCover, catalogFilter, mergeCatalogSnapshots, berlinDate, titleKey } from '../lib/ps-plus-catalog.mjs';
import { safePlusCover, dailyLabel } from '../lib/radar-media.mjs';
import { CATALOG_TABS, prepareCatalog } from '../lib/radar-catalog-view.mjs';
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
 assert.match(goalCss,/nth-child\(2\):last-child/);
 assert.match(sanitizer,/&#8220;\|&#8221;/);
 assert.match(sanitizer,/Aktuelle Store-Aktion endet bald/);
 assert.match(editorial,/pageHero/);
 assert.match(editorial,/type:'editorial'/);
});
test('catalog route requires the existing private session',async()=>{
 const page=await fs.readFile(new URL('../app/ps-plus/page.jsx',import.meta.url),'utf8');
 assert.match(page,/safeEqual\(jar\.get\(COOKIE_NAME\)\?\.value, expected\)/);
 assert.match(page,/redirect\('\/'\)/);
});
