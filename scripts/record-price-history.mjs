import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const sourcesPath = new URL('../data/sources.json', import.meta.url);
const historyPath = new URL('../data/price-history.json', import.meta.url);
const archiveDir = new URL('../data/archive/', import.meta.url);

function numberFromEuro(value) {
  if (!value) return null;
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberFromPercent(value) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function isoDate(value) {
  const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await fs.readFile(url, 'utf8'));
  } catch {
    return fallback;
  }
}

function ingestIssue(history, issue, sourceUrls) {
  const date = isoDate(issue?.date);
  if (!date) return 0;
  let added = 0;
  const resolved = issue?.resolvedSources?.storeDeals || {};

  for (const deal of issue?.deals || []) {
    const price = numberFromEuro(deal.price);
    if (!(price > 0) || !deal.title) continue;
    const oldPrice = numberFromEuro(deal.oldPrice);
    const discount = numberFromPercent(deal.discount);
    const previous = history.games[deal.title] || { currency: 'EUR', points: [] };
    const point = {
      date,
      price,
      ...(oldPrice > price ? { oldPrice } : {}),
      ...(discount !== null ? { discount } : {}),
    };

    const points = [...(previous.points || []).filter((item) => item.date !== date), point]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-180);

    const gameStoreUrl = issue?.gameDetails?.[deal.title]?.storeUrl || null;
    history.games[deal.title] = {
      ...previous,
      title: deal.title,
      currency: 'EUR',
      platform: deal.platform || previous.platform || null,
      storeUrl: resolved[deal.title] || gameStoreUrl || sourceUrls[deal.title] || previous.storeUrl || null,
      points,
    };
    added += 1;
  }
  return added;
}

function confidenceFor(points) {
  if (points >= 7) return 'hoch';
  if (points >= 3) return 'mittel';
  return 'niedrig';
}

function signalFor(game, deal, storeEnd, now) {
  const points = (game.points || []).filter((point) => Number.isFinite(point.price));
  if (!points.length) return null;

  const latest = points.at(-1);
  const prices = points.map((point) => point.price);
  const low = Math.min(...prices);
  const deltaFromLowPct = low > 0 ? ((latest.price - low) / low) * 100 : 0;
  const currentDealPrice = numberFromEuro(deal?.price);
  const currentDiscount = numberFromPercent(deal?.discount) ?? latest.discount ?? null;
  const endMs = storeEnd ? new Date(storeEnd).getTime() : NaN;
  const activeDeal = Boolean(deal && currentDealPrice > 0 && Number.isFinite(endMs) && endMs > now.getTime());
  const daysRemaining = activeDeal ? Math.max(0, Math.ceil((endMs - now.getTime()) / 86400000)) : null;
  const confidence = confidenceFor(points.length);
  const atRadarLow = deltaFromLowPct <= 2;
  const nearRadarLow = deltaFromLowPct <= 5;

  const base = {
    version: 1,
    activeDeal,
    confidence,
    measurements: points.length,
    currentPrice: activeDeal ? currentDealPrice : null,
    lastObservedPrice: latest.price,
    lastObservedDate: latest.date,
    radarLow: low,
    deltaFromLowPct: Number(deltaFromLowPct.toFixed(1)),
    discount: activeDeal ? currentDiscount : null,
    daysRemaining,
  };

  if (!activeDeal) {
    return {
      ...base,
      code: 'wait',
      label: 'WARTEN',
      reason: 'Kein aktuell verifizierter Store-Deal im Radar.',
    };
  }

  if (points.length < 2) {
    return {
      ...base,
      code: 'watch',
      label: 'BEOBACHTEN',
      reason: `${currentDiscount !== null ? `-${currentDiscount} % Rabatt, ` : ''}aber erst 1 Radar-Messpunkt – das Preisniveau ist noch nicht belastbar.`,
    };
  }

  if (atRadarLow && currentDiscount !== null && currentDiscount >= 50) {
    return {
      ...base,
      code: 'buy',
      label: 'KAUFEN',
      reason: `Aktuell am eigenen Radar-Tief und mit -${currentDiscount} % deutlich reduziert.`,
    };
  }

  if (nearRadarLow && currentDiscount !== null && currentDiscount >= 35) {
    return {
      ...base,
      code: 'watch',
      label: 'BEOBACHTEN',
      reason: `Nur ${deltaFromLowPct.toFixed(1).replace('.', ',')} % über dem eigenen Radar-Tief bei -${currentDiscount} %.`,
    };
  }

  if (deltaFromLowPct > 8) {
    return {
      ...base,
      code: 'wait',
      label: 'WARTEN',
      reason: `Der aktuelle Preis liegt ${deltaFromLowPct.toFixed(1).replace('.', ',')} % über einem bereits gemessenen Radar-Tief.`,
    };
  }

  if (currentDiscount !== null && currentDiscount >= 60) {
    return {
      ...base,
      code: 'watch',
      label: 'BEOBACHTEN',
      reason: `Starker Rabatt von -${currentDiscount} %, aber noch kein eindeutiges Kaufsignal gegenüber dem Radar-Verlauf.`,
    };
  }

  return {
    ...base,
    code: 'wait',
    label: 'WARTEN',
    reason: 'Der aktuelle Rabatt reicht gegenüber dem bisherigen Radar-Verlauf noch nicht für ein Kaufsignal.',
  };
}

const radar = await readJson(radarPath, {});
const sources = await readJson(sourcesPath, {});
const sourceUrls = Object.fromEntries((sources.storeDeals || []).map((item) => [item.title, item.url]));
const history = await readJson(historyPath, { updatedAt: null, games: {} });
history.games ||= {};

let issueCount = 0;
let pointWrites = 0;
try {
  const files = (await fs.readdir(archiveDir))
    .filter((name) => /^\d{3}\.json$/.test(name))
    .sort();
  for (const name of files) {
    const issue = await readJson(new URL(name, archiveDir), null);
    if (!issue) continue;
    issueCount += 1;
    pointWrites += ingestIssue(history, issue, sourceUrls);
  }
} catch {}

pointWrites += ingestIssue(history, radar, sourceUrls);

const now = new Date();
const currentDeals = new Map((radar.deals || []).map((deal) => [deal.title, deal]));
const signalCounts = { buy: 0, watch: 0, wait: 0 };
for (const [title, game] of Object.entries(history.games)) {
  const signal = signalFor(game, currentDeals.get(title), radar.storeEnd, now);
  if (signal) {
    game.signal = signal;
    if (signalCounts[signal.code] !== undefined) signalCounts[signal.code] += 1;
  }
}

history.updatedAt = now.toISOString();
history.method = {
  signalVersion: 1,
  note: 'Radar-Signal basiert ausschließlich auf den eigenen verifizierten Radar-Messpunkten, dem aktuellen Rabatt und dem aktiven Store-Zeitraum; kein externer Allzeit-Tiefpreis.',
};
history.summary = {
  titles: Object.keys(history.games).length,
  points: Object.values(history.games).reduce((sum, game) => sum + (game.points?.length || 0), 0),
  archiveIssuesScanned: issueCount,
  signals: signalCounts,
};

await fs.writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);
console.log(`Price history updated: ${history.summary.titles} titles, ${history.summary.points} points; signals buy=${signalCounts.buy}, watch=${signalCounts.watch}, wait=${signalCounts.wait}.`);
