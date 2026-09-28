export function priceRadarState(signal, lastObservedDate = null) {
  if (!signal) return { kind: 'history', code: 'history', label: 'VERLAUF', current: false, reason: 'Noch kein aktuelles Radar-Signal.' };

  if (signal.subscriptionIncluded) {
    return {
      ...signal,
      kind: 'subscription',
      current: true,
      code: 'subscription',
      label: 'ABO NUTZEN',
    };
  }

  if (signal.activeDeal) {
    return { ...signal, kind: 'deal', current: true };
  }

  const observed = lastObservedDate || signal.lastObservedDate || null;
  return {
    ...signal,
    kind: 'history',
    current: false,
    code: 'history',
    label: 'VERLAUF',
    daysRemaining: null,
    reason: observed
      ? `Aktuell kein verifizierter Store-Deal. Letzte Preisbeobachtung: ${observed}.`
      : 'Aktuell kein verifizierter Store-Deal; der Eintrag bleibt als Preisverlauf erhalten.',
  };
}

export function summarizePriceRadar(items = []) {
  const summary = { buy: 0, watch: 0, wait: 0, subscription: 0, history: 0, current: 0 };
  for (const item of items) {
    const state = item.displaySignal || priceRadarState(item.signal, item.latest?.date);
    if (state.kind === 'history') {
      summary.history += 1;
      continue;
    }
    summary.current += 1;
    if (state.kind === 'subscription') {
      summary.subscription += 1;
      continue;
    }
    if (state.code === 'buy') summary.buy += 1;
    else if (state.code === 'watch') summary.watch += 1;
    else summary.wait += 1;
  }
  return summary;
}

export function priceRadarRank(state) {
  if (!state) return 9;
  if (state.code === 'buy') return 0;
  if (state.code === 'watch') return 1;
  if (state.code === 'subscription') return 2;
  if (state.code === 'wait' && state.current) return 3;
  return 4;
}
