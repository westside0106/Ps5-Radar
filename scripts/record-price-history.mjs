import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
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

function ingestIssue(history, issue) {
  const date = isoDate(issue?.date);
  if (!date) return 0;
  let added = 0;
  const urls = issue?.resolvedSources?.storeDeals || {};

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

    history.games[deal.title] = {
      ...previous,
      title: deal.title,
      currency: 'EUR',
      platform: deal.platform || previous.platform || null,
      storeUrl: urls[deal.title] || previous.storeUrl || null,
      points,
    };
    added += 1;
  }
  return added;
}

const radar = await readJson(radarPath, {});
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
    pointWrites += ingestIssue(history, issue);
  }
} catch {}

pointWrites += ingestIssue(history, radar);
history.updatedAt = new Date().toISOString();
history.summary = {
  titles: Object.keys(history.games).length,
  points: Object.values(history.games).reduce((sum, game) => sum + (game.points?.length || 0), 0),
  archiveIssuesScanned: issueCount,
};

await fs.writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);
console.log(`Price history updated: ${history.summary.titles} titles, ${history.summary.points} points (${pointWrites} issue/deal observations processed).`);
