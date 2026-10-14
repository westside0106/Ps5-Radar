import test from 'node:test';
import assert from 'node:assert/strict';
import {psnTitleKey,enrichPsnLibrary} from '../lib/psn-game-metadata.mjs';
import {verifiedMetadataImage} from '../lib/ps-plus-catalog.mjs';

test('PSN names ignore only explicit platform packaging',()=>{
  assert.equal(psnTitleKey('A Hat in Time PS5'),psnTitleKey('A Hat in Time'));
  assert.equal(psnTitleKey('A Hat in Time (PS4)'),psnTitleKey('A Hat in Time'));
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
