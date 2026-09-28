import assert from 'node:assert/strict';
import { test } from 'node:test';
import { priceRadarRank, priceRadarState, summarizePriceRadar } from '../lib/price-radar-state.mjs';

test('expired deal is history, not a current wait recommendation', () => {
  const state = priceRadarState({ activeDeal:false, code:'wait', label:'WARTEN', lastObservedDate:'2026-09-23' });
  assert.equal(state.kind, 'history');
  assert.equal(state.code, 'history');
  assert.equal(state.label, 'VERLAUF');
  assert.match(state.reason, /2026-09-23/);
});

test('active deal preserves its buy/watch/wait signal', () => {
  const state = priceRadarState({ activeDeal:true, code:'watch', label:'BEOBACHTEN', currentPrice:29.99 });
  assert.equal(state.kind, 'deal');
  assert.equal(state.current, true);
  assert.equal(state.code, 'watch');
});

test('current subscription is distinct from historical price data', () => {
  const state = priceRadarState({ activeDeal:false, subscriptionIncluded:true, code:'wait', label:'ABO NUTZEN' });
  assert.equal(state.kind, 'subscription');
  assert.equal(state.code, 'subscription');
  assert.equal(state.current, true);
});

test('summary counts only current deal recommendations as buy/watch/wait', () => {
  const items = [
    { displaySignal: priceRadarState({ activeDeal:true, code:'watch', label:'BEOBACHTEN' }) },
    { displaySignal: priceRadarState({ activeDeal:true, code:'wait', label:'WARTEN' }) },
    { displaySignal: priceRadarState({ activeDeal:false, code:'wait', label:'WARTEN' }, '2026-09-20') },
    { displaySignal: priceRadarState({ activeDeal:false, subscriptionIncluded:true, code:'wait', label:'ABO NUTZEN' }) },
  ];
  assert.deepEqual(summarizePriceRadar(items), { buy:0, watch:1, wait:1, subscription:1, history:1, current:3 });
  assert.ok(priceRadarRank(items[0].displaySignal) < priceRadarRank(items[2].displaySignal));
});
