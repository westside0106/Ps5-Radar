import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { datedEventBadge } from '../lib/platform-core/model.mjs';
import { dailyLabel } from '../lib/radar-media.mjs';

test('today labels require the exact calendar day', () => {
  assert.equal(dailyLabel('28.09.2026', '28.09.2026'), 'HEUTE NEU');
  assert.equal(dailyLabel('27.09.2026', '28.09.2026'), 'SEIT 27.09.');
  assert.equal(dailyLabel('29.09.2026', '28.09.2026'), 'AB 29.09.');
});

test('platform events require verification before HEUTE NEU', () => {
  const now = new Date('2026-09-28T12:00:00+02:00');
  assert.equal(datedEventBadge({ verified: true, eventDate: '2026-09-28', kind: 'release' }, now), 'HEUTE NEU');
  assert.equal(datedEventBadge({ verified: false, eventDate: '2026-09-28', kind: 'release' }, now), 'AKTUELL');
  assert.equal(datedEventBadge({ verified: true, eventDate: '2026-09-28', kind: 'deadline' }, now), 'HEUTE RELEVANT');
  assert.equal(datedEventBadge({ verified: true, eventDate: '2026-09-29', kind: 'release' }, now), 'AB 29.09.');
});

test('Daily pipeline gates the final issue on temporal semantics', async () => {
  const workflow = await fs.readFile(new URL('../.github/workflows/daily-radar.yml', import.meta.url), 'utf8');
  const finalizer = await fs.readFile(new URL('./finalize-health.mjs', import.meta.url), 'utf8');
  const validator = await fs.readFile(new URL('./validate-temporal-semantics.mjs', import.meta.url), 'utf8');
  assert.match(workflow, /Validate date semantics and relative copy/);
  assert.match(workflow, /npm run radar:semantics/);
  assert.match(finalizer, /temporalCheck\?\.status !== 'ok'/);
  assert.match(validator, /staleRelativeCopyFixed/);
  assert.match(validator, /candidateAudit/);
  assert.match(validator, /vergangener Termin wird als kommend geführt/);
});
