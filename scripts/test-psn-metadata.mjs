import test from 'node:test';
import assert from 'node:assert/strict';
import {psnTitleKey,enrichPsnLibrary} from '../lib/psn-game-metadata.mjs';
import {verifiedMetadataImage} from '../lib/ps-plus-catalog.mjs';

test('PSN names ignore only explicit platform packaging',()=>{
  assert.equal(psnTitleKey('A Hat in Time PS5'),psnTitleKey('A Hat in Time'));
  assert.equal(psnTitleKey('A Hat in Time (PS4)'),psnTitleKey('A Hat in Time'));
  assert.equal(psnTitleKey('Grand Theft Auto V (PlayStation®5)'),psnTitleKey('Grand Theft Auto V'));
  assert.equal(psnTitleKey('Grand Theft Auto V (PlayStation™4)'),psnTitleKey('Grand Theft Auto V'));
  assert.notEqual(psnTitleKey('Assassin’s Creed Mirage Deluxe Edition'),psnTitleKey('Assassin’s Creed Mirage'));
  assert.notEqual(psnTitleKey('Final Fantasy VII Remake'),psnTitleKey('Final Fantasy VII Rebirth'));
});

test('already-enriched PS Plus metadata reaches the private PSN library',async()=>{
  const {played,titles}=await enrichPsnLibrary([{titleId:'CUSA00001',name:'A Hat in Time',playDuration:'PT9H40M'}],[{trophyTitleName:'A Hat in Time',progress:50}]);
  assert.equal(played[0].titleId,'CUSA00001');
  assert.equal(played[0].playDuration,'PT9H40M');
  assert.ok(played[0].metadata?.releaseDate);
  assert.ok(played[0].metadata?.summary);
  assert.ok(played[0].metadata?.coverUrl?.startsWith('https://'));
  assert.ok(titles[0].metadata?.coverUrl?.startsWith('https://'));
});

test('unknown games are not falsely assigned metadata or made up',async()=>{
  const {played}=await enrichPsnLibrary([{name:'Totally Unreleased Game QZXV 123',playDuration:null}],[]);
  assert.equal(played[0].metadata,undefined);
});

test('IGDB artwork URLs are restricted to fixed HTTPS cover paths',()=>{
  assert.equal(verifiedMetadataImage('https://images.igdb.com/igdb/image/upload/t_cover_big_2x/abc123.jpg'),'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/abc123.jpg');
  assert.equal(verifiedMetadataImage('https://evil.invalid/igdb/image/upload/t_cover_big_2x/abc123.jpg'),null);
  assert.equal(verifiedMetadataImage('https://images.igdb.com/igdb/image/upload/t_cover_big_2x/../../secret.jpg'),null);
});

import {communityInsightFor,communityInsightCount,insightTitleKey,parseCommunityInsights} from '../lib/psn-community-insights.mjs';

test('all 376 imported historical game entries retain independent sources',()=>{
  assert.equal(communityInsightCount,376);
  const record=communityInsightFor("Assassin’s Creed Valhalla (PS5)");
  assert.equal(record.metacritic,80);
  assert.equal(record.userScore,6.1);
  assert.equal(record.rushedHours,61);
  assert.equal(record.platinumHours,148);
  assert.equal(record.asOf,'2026-09');
  assert.equal(record.historicalStatus,'listed');
});

test('PSN spelling differences do not create arbitrary fuzzy game matches',()=>{
  assert.equal(communityInsightFor('Red Dead Redemption 2').metacritic,97);
  assert.equal(communityInsightFor('Red Dead Redemption 2').rushedHours,51);
  assert.equal(insightTitleKey('God of War: Ragnarök'),insightTitleKey('God Of War: Ragnarok'));
  assert.equal(communityInsightFor('Assassin’s Creed Shadows'),null);
  assert.equal(communityInsightFor('Final Fantasy VII Rebirth'),null);
  assert.notEqual(insightTitleKey('Until Dawn (2015)'),insightTitleKey('Until Dawn (2024)'));
  assert.notEqual(insightTitleKey('Ghost of Tsushima'),insightTitleKey("Ghost of Tsushima: Director's Cut"));
});

test('removed entries are NOT represented as live PS Plus status',()=>{
  const gone=communityInsightFor('WWE 2K25');
  assert.equal(gone.historicalStatus,'removed');
  assert.equal(gone.removedNote,'FEB 2026');
  assert.equal(communityInsightFor('Tropico 6').historicalStatus,'additional');
  assert.equal(parseCommunityInsights('A|2|3|80|8|80|L|\\nA|2|3|80|8|80|L|').size,0);
});

test('library enrichment retains exact PSN fields and attaches historical estimates',async()=>{
  const raw={name:"Assassin's Creed Valhalla",titleId:'PPSA01490_00',playDuration:'PT22H',lastPlayedDateTime:'2026-10-22T00:00:00Z'};
  const {played}=await enrichPsnLibrary([raw],[]);
  assert.equal(played[0].playDuration,raw.playDuration);
  assert.equal(played[0].lastPlayedDateTime,raw.lastPlayedDateTime);
  assert.equal(played[0].communityInsight.platinumHours,148);
});
