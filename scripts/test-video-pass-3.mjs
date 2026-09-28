import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';

test('iPhone layout is keyed to physical touch-phone detection, not CSS viewport width', async () => {
  const fixes = await fs.readFile(new URL('../app/VideoReviewFixes.jsx', import.meta.url), 'utf8');
  const css = await fs.readFile(new URL('../app/video-pass-2.css', import.meta.url), 'utf8');
  assert.match(fixes, /window\.screen\?\.width/);
  assert.match(fixes, /navigator\.maxTouchPoints/);
  assert.match(fixes, /classList\.toggle\('is-touch-phone'/);
  assert.match(css, /html\.is-touch-phone \.catalog-grid/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.ok(!/@media \(hover:none\) and \(pointer:coarse\) and \(max-width:900px\)/.test(css));
});

test('catalog first viewport covers are promoted while the rest stay lazy', async () => {
  const fixes = await fs.readFile(new URL('../app/VideoReviewFixes.jsx', import.meta.url), 'utf8');
  const ps = await fs.readFile(new URL('../app/ps-plus/CatalogClient.jsx', import.meta.url), 'utf8');
  const xbox = await fs.readFile(new URL('../app/xbox/XboxClient.jsx', import.meta.url), 'utf8');
  assert.match(ps, /loading="lazy"/);
  assert.match(xbox, /loading="lazy"/);
  assert.match(fixes, /index >= 8/);
  assert.match(fixes, /image\.loading = 'eager'/);
  assert.match(fixes, /image\.fetchPriority = 'high'/);
  assert.match(fixes, /MutationObserver/);
});

test('catalog browse surfaces do not get a floating watchlist overlay', async () => {
  const dock = await fs.readFile(new URL('../app/WatchlistDock.jsx', import.meta.url), 'utf8');
  assert.match(dock, /startsWith\('\/ps-plus'\)/);
  assert.match(dock, /startsWith\('\/xbox'\)/);
  assert.match(dock, /startsWith\('\/preise'\)/);
  assert.match(dock, /startsWith\('\/bild'\)/);
});

test('phone catalog keeps only navigation sticky, not search and result rows', async () => {
  const css = await fs.readFile(new URL('../app/video-pass-2.css', import.meta.url), 'utf8');
  assert.match(css, /html\.is-touch-phone \.catalog-filter-head\{[\s\S]*?position:static!important/);
  assert.match(css, /html\.is-touch-phone \.catalog-results-head\{[\s\S]*?position:static!important/);
  assert.match(css, /html\.is-touch-phone \.price-radar-page \.watchlist-grid\{grid-template-columns:1fr!important/);
});
