import fs from 'node:fs/promises';

const radarPath = new URL('../data/radar.json', import.meta.url);
const statePath = new URL('../data/source-state.json', import.meta.url);

const radar = JSON.parse(await fs.readFile(radarPath, 'utf8'));
let state = {};
try { state = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch {}

const now = new Date();
const berlinDate = radar.date || new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric'
}).format(now);

const baseSources = [
  ['PlayStation Blog', state.playstationBlog],
  ['Monats-Releases', state.monthlyReleases],
  ['PS Plus monatlich', state.psPlusMonthly],
  ['PS Plus aktuell', state.psPlusWhatsNew],
  ['EA Play', state.eaPlay],
  ['Ubisoft+', state.ubisoftPlus],
  ...(state.storeDeals || []).map((item) => [`Store: ${item.title}`, item])
].map(([name, result]) => ({ name, ok: Boolean(result?.ok) }));

const totalSources = baseSources.length;
const okSources = baseSources.filter((item) => item.ok).length;
const failedSources = totalSources - okSources;

const issues = [];
for (const source of baseSources) {
  if (!source.ok) issues.push(`${source.name}: Quellenabruf fehlgeschlagen`);
}
for (const note of radar.automationV2?.notes || []) issues.push(`Automation: ${note}`);
for (const warning of radar.storeDiscovery?.warnings || []) issues.push(`Store-Discovery: ${warning}`);
for (const warning of radar.enrichment?.warnings || []) issues.push(`Detail-Enrichment: ${warning}`);
for (const error of radar.sourceCheck?.errors || []) issues.push(error);

const uniqueIssues = [...new Set(issues.filter(Boolean))];
const storeVerified = Number(radar.storeDiscovery?.verified || 0);
const storeSelected = Number(radar.storeDiscovery?.selected || 0);
const enriched = Number(radar.enrichment?.enriched || 0);
const detailTitles = Number(radar.enrichment?.titles || 0);
const status = uniqueIssues.length ? 'warning' : 'ok';

radar.health = {
  status,
  checkedAt: now.toISOString(),
  okSources,
  totalSources,
  failedSources,
  warnings: uniqueIssues.length,
  storeDiscoveryMode: radar.storeDiscovery?.mode || null,
  storeProductsVerified: storeVerified,
  storeDealsSelected: storeSelected,
  enrichedTitles: enriched,
  detailTitles,
  automationNotes: (radar.automationV2?.notes || []).length,
  lastSuccessfulCheck: status === 'ok' ? now.toISOString() : (radar.health?.lastSuccessfulCheck || null)
};

radar.sourceCheck = {
  ...(radar.sourceCheck || {}),
  checkedAt: now.toISOString(),
  errors: uniqueIssues,
  sources: baseSources
};

const detailText = detailTitles ? ` · ${enriched}/${detailTitles} Details` : '';
const storeText = storeVerified ? ` · Store ${storeVerified} geprüft` : '';
radar.radarCheck = status === 'ok'
  ? `Stand ${berlinDate} · ${okSources}/${totalSources} Quellen${storeText}${detailText}`
  : `Stand ${berlinDate} · ${okSources}/${totalSources} Quellen · ${uniqueIssues.length} Warnung(en)`;

await fs.writeFile(radarPath, JSON.stringify(radar, null, 2) + '\n');
console.log(`Pipeline health: ${status}; sources=${okSources}/${totalSources}; store=${storeVerified}; details=${enriched}/${detailTitles}; warnings=${uniqueIssues.length}.`);
