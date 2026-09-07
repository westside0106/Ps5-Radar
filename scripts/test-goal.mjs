import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { emptyCatalog, normalizeCatalog, catalogCover, catalogFilter, mergeCatalogSnapshots, berlinDate } from '../lib/ps-plus-catalog.mjs';
import { safePlusCover, dailyLabel } from '../lib/radar-media.mjs';
import { prepareCatalog } from '../lib/radar-catalog-view.mjs';
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
test('catalog membership is not confused with a monthly claim',()=>{
 const c=fixture();const radar={plusGames:[{title:'Testspiel',storeUrl:store}],psplusText:'01.09.–05.10.2026'};
 const view=prepareCatalog(c,radar,new Date('2026-09-07T12:00:00Z'));
 assert.equal(view.games.length,1);assert.deepEqual(view.games[0].services,['extra']);
 assert.equal(view.sections.extra.complete,true);assert.equal(view.sections.trials.complete,false);
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
test('leaving filter only contains confirmed future dates',()=>{
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
test('catalog route requires the existing private session',async()=>{
 const page=await fs.readFile(new URL('../app/ps-plus/page.jsx',import.meta.url),'utf8');
 assert.match(page,/safeEqual\(jar\.get\(COOKIE_NAME\)\?\.value, expected\)/);
 assert.match(page,/redirect\('\/'\)/);
});
