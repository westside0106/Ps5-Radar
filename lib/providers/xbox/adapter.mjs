import { normalizeSnapshot, productKey } from '../../platform-core/model.mjs';
// Adapter for already verified source observations. It does not scrape or invent live data.
export function emptyXboxSnapshot(checkedAt=new Date().toISOString()) {
  return {schemaVersion:1,platform:'xbox',region:'DE',checkedAt,
    coverage:{complete:false,expected:null,count:0,invalid:0,errors:['Xbox source collector not implemented.']},
    products:[],offers:[],entitlements:[],evidence:[]};
}
export function fromVerifiedXboxObservations(raw) {
  if(!raw||raw.platform!=='xbox'||raw.region!=='DE') throw new Error('Explicit Xbox DE observations required');
  const snapshot=normalizeSnapshot(raw);
  for(const p of snapshot.products) {
    if(p.platform!=='xbox'||p.key!==productKey('xbox',p.kind,p.id)) throw new Error('Cross-platform identity rejected');
  }
  return snapshot;
}
// Erfasst die offizielle Katalogansicht ueber die dort angebotenen Filter.
// Jede Sicht wird gegen den Zaehler der Quelle geprueft; die Vereinigung gilt
// nicht als Beleg fuer den gesamten Katalog. Bei einem Fehlschlag entsteht ein
// ausdruecklich unvollstaendiger Snapshot, keine erfundenen Daten.
export async function collectXboxSnapshot(views, options) {
  const { collectXboxViews, buildXboxSnapshot } = await import('./collector.mjs');
  const raw = await collectXboxViews(views, options);
  return normalizeSnapshot(buildXboxSnapshot(raw));
}
