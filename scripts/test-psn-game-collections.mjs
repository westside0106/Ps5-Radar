import test from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTIONS_KEY,CUSTOM_GAMES_KEY,VIEW_KEY,VIEWS,gameKey,isManualGame,normalizeManualGames,combinedGames,normalizeCollections,filterCollection,toggleCollectionGame} from '../lib/psn-game-collections.mjs';
import {validCloudPayload} from '../lib/psn-cloud-helpers.mjs';

test('collections, manual games and library view have stable distinct storage keys',()=>{
 assert.notEqual(COLLECTIONS_KEY,CUSTOM_GAMES_KEY);
 assert.notEqual(COLLECTIONS_KEY,VIEW_KEY);
 assert.deepEqual(VIEWS,['cards','list','shelf']);
});
test('manual planned titles are retained alongside PSN games without inventing PSN ownership',()=>{
 const played=[{titleId:'PPSA00001_00',name:'Example Game',playDuration:'PT20H'}];
 const manual=[{titleId:'custom:example-game',name:'Example Game',playDuration:'PT900H'},
               {titleId:'custom:future-game',name:'Future Game'},
               {titleId:'unsafe',name:'Invalid Game'}];
 const merged=combinedGames(played,manual);
 assert.equal(merged.length,3);
 assert.equal(merged[0].playDuration,'PT20H');
 assert.equal(isManualGame(merged[1]),true);
 assert.equal(merged[1].playDuration,undefined);
 assert.equal(merged[2].name,'Future Game');
 assert.equal(normalizeManualGames(manual).length,2);
});
test('collection memberships support multiple shelves, preserve stable ids and de-duplicate',()=>{
 const raw=[
  {id:'col:open-world',name:'Open World',gameIds:['PPSA00001_00','custom:future-game','PPSA00001_00']},
  {id:'col:platin-jagd',name:'Platin',gameIds:['PPSA00001_00']},
  {id:'col:open-world',name:'duplicate',gameIds:[]},
  {id:'invalid',name:'Unsafe',gameIds:[]}
 ];
 const collections=normalizeCollections(raw);
 assert.equal(collections.length,2);
 assert.deepEqual(collections[0].gameIds,['PPSA00001_00','custom:future-game']);
 const games=[{titleId:'PPSA00001_00',name:'Example Game'},{titleId:'custom:future-game',name:'Future Game',isManual:true},{titleId:'PPSA00002_00',name:'Other Game'}];
 assert.deepEqual(filterCollection(games,'col:open-world',collections).map(gameKey),['PPSA00001_00','custom:future-game']);
 const moved=toggleCollectionGame(collections,'col:platin-jagd','custom:future-game');
 assert.deepEqual(moved[1].gameIds,['PPSA00001_00','custom:future-game']);
 assert.deepEqual(collections[1].gameIds,['PPSA00001_00']);
 assert.deepEqual(toggleCollectionGame(moved,'col:platin-jagd','custom:future-game')[1].gameIds,['PPSA00001_00']);
});
test('cloud profile accepts collections while old backups without them remain valid',()=>{
 assert.equal(validCloudPayload({notes:{},manualGames:[],collections:[{id:'col:open-world',name:'Open World',gameIds:[]}]}),true);
 assert.equal(validCloudPayload({notes:{},manualGames:[]}),true);
 assert.equal(validCloudPayload({collections:{id:'col:open-world'}}),false);
});
