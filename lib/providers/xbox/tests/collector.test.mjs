import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minorUnits, bigId, countFromText, stableCountDecision, buildXboxSnapshot, XBOX_VIEWS, XBOX_CATALOG, XBOX_GAMEPASS_CATALOG, XBOX_TARGET} from '../collector.mjs';

test('prices become exact integer minor units, never floats', () => {
  assert.equal(minorUnits('3,99 €'), 399);
  assert.equal(minorUnits('79,99 €'), 7999);
  assert.equal(minorUnits('1.299,00 €'), 129900);
  assert.equal(minorUnits('13,49 €+'), 1349);
  // Kein Preis ist kein Preis - nicht auf 0 raten.
  assert.equal(minorUnits('Kostenlos+'), null);
  assert.equal(minorUnits(''), null);
  assert.equal(minorUnits(null), null);
});

test('product identity comes from the store id, not from the slug', () => {
  assert.equal(bigId('https://www.xbox.com/de-DE/games/store/shelldiver/9n51nr4gx891'), '9n51nr4gx891');
  assert.equal(bigId('https://www.xbox.com/de-de/games/store/x/cfq7ttc0khs0?icid=DSM_All'), 'cfq7ttc0khs0');
  assert.equal(bigId('https://www.xbox.com/de-DE/games/store/nur-slug/'), null);
  assert.equal(bigId('kein-link'), null);
});

test('the source counter is read exactly, including thousands separators', () => {
  assert.equal(countFromText('Alle Spiele durchsuchen (1.301 Spiele)'), 1301);
  assert.equal(countFromText('Alle Spiele durchsuchen (12.675 Spiele)'), 12675);
  assert.equal(countFromText('Alle Spiele durchsuchen (26 Spiele)'), 26);
  assert.equal(countFromText('Failed to Get Channel (0 Spiele)'), 0);
  assert.equal(countFromText('irgendein Text'), null);
});

test('subscription tiers stay separate and are never merged into one flag', () => {
  const tiers = Object.values(XBOX_VIEWS).filter(view => view.serviceId);
  const ids = tiers.map(view => `${view.serviceId}:${view.tierId}`);
  assert.equal(new Set(ids).size, ids.length, 'Jede Sicht braucht eine eigene Dienst-/Tier-Kennung');
  // Game Pass, EA Play und Ubisoft+ sind getrennte Dienste.
  assert.ok(tiers.some(v => v.serviceId === 'xbox-game-pass' && v.tierId === 'essential'));
  assert.ok(tiers.some(v => v.serviceId === 'xbox-game-pass' && v.tierId === 'premium'));
  assert.ok(tiers.some(v => v.serviceId === 'xbox-game-pass' && v.tierId === 'ultimate'));
  assert.ok(!tiers.some(v => v.tierId === 'console'), 'obsolete Game Pass für Konsole tier must not be published');
  assert.ok(tiers.some(v => v.serviceId === 'ea-play'));
  assert.ok(tiers.some(v => v.serviceId === 'ubisoft-plus'));
  assert.ok(!tiers.some(v => v.serviceId === 'xbox-game-pass' && v.tierId === 'ea-play'));
});

test('the catalog url pins exactly one target platform', () => {
  assert.match(XBOX_CATALOG, /^https:\/\/www\.xbox\.com\/de-DE\//);
  assert.match(XBOX_CATALOG, /PlayWith=XboxSeriesX%7CS(?!%2C)/, 'Ohne festgelegtes Ziel waeren targets nicht belegbar');
  assert.equal(XBOX_TARGET, 'xbox-series');
});

test('same count is accepted only after independent filter and product evidence', () => {
  assert.equal(stableCountDecision({value: 800,previous:800,repeated:true,filterConfirmed:false,cardsChanged:false}),false);
  assert.equal(stableCountDecision({value: 800,previous:800,repeated:true,filterConfirmed:true,cardsChanged:false}),false);
  assert.equal(stableCountDecision({value: 800,previous:800,repeated:true,filterConfirmed:false,cardsChanged:true}),false);
  assert.equal(stableCountDecision({value: 800,previous:800,repeated:true,filterConfirmed:true,cardsChanged:true}),true);
  assert.equal(stableCountDecision({value: 692,previous:900,repeated:true,filterConfirmed:false,cardsChanged:false}),true);
  assert.equal(stableCountDecision({value:null,previous:900,repeated:true,filterConfirmed:true,cardsChanged:true}),false);
  assert.equal(stableCountDecision({value:800,previous:900,repeated:false,filterConfirmed:true,cardsChanged:true}),false);
});

test('Game Pass plans and EA Play originate only from verified sources', () => {
  assert.equal(XBOX_VIEWS['gamepass-essential'].source,'gamepass');
  assert.equal(XBOX_VIEWS['gamepass-premium'].source,'gamepass');
  assert.equal(XBOX_VIEWS['ea-play'].source,'gamepass');
  assert.equal(XBOX_VIEWS['ea-play'].group,'Sammlungen');
  assert.match(XBOX_GAMEPASS_CATALOG,/xbox-game-pass\/games$/);
  const ts='2026-10-12T10:00:00Z';
  const raw={checkedAt:ts,sourceUrl:XBOX_CATALOG,target:XBOX_TARGET,errors:[],results:{
    'gamepass-essential':{key:'gamepass-essential',view:XBOX_VIEWS['gamepass-essential'],sourceUrl:XBOX_GAMEPASS_CATALOG,
       expected:1,observed:1,invalid:0,entries:[{id:'9n51nr4gx891',title:'Belegtes Spiel',href:'https://www.xbox.com/de-DE/games/store/spiel/9n51nr4gx891',cover:null,price:null,regularPrice:null}]},
    'ea-play':{key:'ea-play',view:XBOX_VIEWS['ea-play'],expected:null,observed:0,invalid:0,entries:[]}
  }};
  const snap=buildXboxSnapshot(raw);
  assert.equal(snap.products.length,1);
  assert.equal(snap.entitlements.length,1);
  assert.equal(snap.entitlements[0].tierId,'essential');
  assert.equal(snap.coverage.views['gamepass-essential'].complete,true);
  assert.equal(snap.coverage.views['ea-play'].complete,false);
  assert.equal(snap.evidence[0].url,XBOX_GAMEPASS_CATALOG);
  assert.equal(snap.evidence[0].sourceId,'xbox-game-pass-de');
});

test('a repeated source card never fills an apparently missing unique game', () => {
  const raw={checkedAt:'2026-10-12T10:00:00Z',sourceUrl:XBOX_CATALOG,target:XBOX_TARGET,errors:[],results:{
    deals:{key:'deals',view:XBOX_VIEWS.deals,expected:2,observed:2,invalid:0,
      entries:[{id:'9n51nr4gx891',title:'A',href:'https://www.xbox.com/de-DE/games/store/a/9n51nr4gx891',cover:null}]}
  }};
  assert.equal(buildXboxSnapshot(raw).coverage.views.deals.complete,false);
});
