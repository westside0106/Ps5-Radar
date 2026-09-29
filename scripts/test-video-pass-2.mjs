import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { catalogFilter } from '../lib/radar-catalog-view.mjs';

test('PS catalog keeps useful title sorting without date metadata', () => {
  const games = [
    { id:'1', title:'Alpha', services:['extra'], platforms:['PS5'], genres:[] },
    { id:'2', title:'Zulu', services:['extra'], platforms:['PS5'], genres:[] },
  ];
  assert.deepEqual(catalogFilter(games,{ service:'extra', sort:'title-desc' }).map(game => game.title), ['Zulu','Alpha']);
});

test('iPhone video pass protects touch layouts and raw image navigation', async () => {
  const css = await fs.readFile(new URL('../app/video-pass-2.css', import.meta.url), 'utf8');
  const client = await fs.readFile(new URL('../app/VideoReviewFixes.jsx', import.meta.url), 'utf8');
  const viewer = await fs.readFile(new URL('../app/bild/page.jsx', import.meta.url), 'utf8');
  const catalog = await fs.readFile(new URL('../app/ps-plus/CatalogClient.jsx', import.meta.url), 'utf8');
  assert.ok(!/pointer:coarse/.test(css),'Core phone layout must not depend on CSS viewport media queries');
  assert.match(css, /html\.is-touch-phone \.catalog-grid\{grid-template-columns:repeat\(2/);
  assert.match(client, /navigator\.maxTouchPoints > 0/);
  assert.match(client, /shortestSide <= 500/);
  assert.match(css, /catalog-grid\{grid-template-columns:repeat\(2/);
  assert.match(css, /price-radar-page \.watchlist-grid\{grid-template-columns:1fr/);
  assert.match(client, /href="\/daily\/latest\.png"/);
  assert.match(client, /setAttribute\('href', '\/bild'\)/);
  assert.match(viewer, /src="\/daily\/latest\.png"/);
  assert.match(catalog, /Titel Z–A/);
});
