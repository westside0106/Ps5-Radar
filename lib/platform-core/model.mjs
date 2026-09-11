import { PLATFORMS } from './platforms.mjs';
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const unique = arr => [...new Set(arr)];
const dateOnly = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+'T12:00:00Z'));
function must(cond, message) { if (!cond) throw new Error(message); }
function iso(value, label, nullable=false) {
  if (nullable && value == null) return null;
  must(typeof value === 'string' && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value), `${label}: ISO timestamp with offset required`);
  return new Date(value).toISOString();
}
function money(value) { must(Number.isSafeInteger(value) && value >= 0, 'Price must be nonnegative integer minor units'); return value; }
function url(value, label) { const u=new URL(value); must(u.protocol === 'https:', `${label}: HTTPS required`); return u.href; }
export function productKey(platform, kind, id) {
  must(Object.hasOwn(PLATFORMS, platform), 'Unknown platform');
  must(['product','concept','sku','bundle'].includes(kind), 'Unknown identity kind');
  must(typeof id==='string' && /^[A-Za-z0-9_-]{1,180}$/.test(id), 'Invalid product identity');
  return `${platform}:${kind}:${id}`;
}
export function normalizeEvidence(raw) {
  must(isObject(raw), 'Evidence required');
  must(typeof raw.id==='string' && raw.id.length>0, 'Evidence ID required');
  must(['official','store','secondary'].includes(raw.level), 'Evidence level required');
  must(typeof raw.sourceId==='string' && raw.sourceId.length>0, 'Source ID required');
  must(typeof raw.region==='string' && raw.region.length>0, 'Evidence region required');
  return { id:raw.id, sourceId:raw.sourceId, url:url(raw.url,'Evidence URL'), level:raw.level,
    region:raw.region, observedAt:iso(raw.observedAt,'observedAt'),
    publishedAt:raw.publishedAt==null?null:iso(raw.publishedAt,'publishedAt'),
    subject:raw.subject||null, note:raw.note||null };
}
export function normalizeProduct(raw) {
  must(isObject(raw), 'Product required');
  const {platform, kind, id} = raw;
  const key=productKey(platform,kind,id);
  must(typeof raw.title==='string' && raw.title.trim(), 'Product title required');
  const validTargets=PLATFORMS[platform].supportedTargets;
  must(Array.isArray(raw.targets) && raw.targets.length>0 && raw.targets.every(t=>validTargets.includes(t)), 'Explicit supported targets required');
  must(Array.isArray(raw.evidenceIds) && raw.evidenceIds.length>0, 'Product identity evidence required');
  must(['game','edition','bundle','dlc','trial'].includes(raw.productType), 'Product type required');
  return {key,platform,store:PLATFORMS[platform].store,kind,id,title:raw.title.trim(),
    gameId:raw.gameId||null,productType:raw.productType,targets:unique(raw.targets),
    storeUrl:url(raw.storeUrl,'Product URL'),evidenceIds:unique(raw.evidenceIds),
    releaseDate:raw.releaseDate||null,cover:raw.cover||null};
}
export function normalizeOffer(raw) {
  must(isObject(raw), 'Offer required');
  must(typeof raw.id==='string' && raw.id, 'Offer ID required');
  must(typeof raw.productKey==='string' && /^(ps|xbox):/.test(raw.productKey), 'Namespaced product required');
  must(/^[A-Z]{3}$/.test(raw.currency||''), 'Currency required');
  must(typeof raw.region==='string' && raw.region, 'Region required');
  must(Array.isArray(raw.evidenceIds) && raw.evidenceIds.length>0, 'Offer evidence required');
  const priceMinor=money(raw.priceMinor);
  const regularPriceMinor=raw.regularPriceMinor==null?null:money(raw.regularPriceMinor);
  must(regularPriceMinor==null || regularPriceMinor>=priceMinor, 'Regular price lower than current price');
  return {id:raw.id,productKey:raw.productKey,currency:raw.currency,region:raw.region,
    priceMinor,regularPriceMinor,observedAt:iso(raw.observedAt,'Offer observedAt'),
    validFrom:raw.validFrom==null?null:iso(raw.validFrom,'validFrom'),
    validUntil:raw.validUntil==null?null:iso(raw.validUntil,'validUntil'),
    evidenceIds:unique(raw.evidenceIds)};
}
export function normalizeEntitlement(raw) {
  must(isObject(raw), 'Entitlement required');
  must(typeof raw.id==='string' && raw.id, 'Entitlement ID required');
  must(typeof raw.productKey==='string' && /^(ps|xbox):/.test(raw.productKey), 'Namespaced product required');
  must(typeof raw.serviceId==='string' && raw.serviceId, 'Service ID required');
  must(typeof raw.tierId==='string' && raw.tierId, 'Exact tier ID required');
  must(['claim','catalog','trial','owned','free'].includes(raw.accessKind), 'Access kind required');
  must(Array.isArray(raw.targets) && raw.targets.length>0, 'Explicit entitlement targets required');
  must(Array.isArray(raw.evidenceIds) && raw.evidenceIds.length>0, 'Entitlement evidence required');
  const hours=raw.trialHours==null?null:raw.trialHours;
  must(hours==null || Number.isFinite(hours)&&hours>0, 'Invalid trial duration');
  must(raw.accessKind==='trial' || hours==null, 'Trial hours only for trials');
  return {id:raw.id,productKey:raw.productKey,serviceId:raw.serviceId,tierId:raw.tierId,
    accessKind:raw.accessKind,targets:unique(raw.targets),region:raw.region,
    availableFrom:raw.availableFrom||null,availableUntil:raw.availableUntil||null,
    trialHours:hours,evidenceIds:unique(raw.evidenceIds)};
}
export function normalizeSnapshot(raw) {
  must(isObject(raw) && raw.schemaVersion===1, 'Unsupported snapshot schema');
  must(Object.hasOwn(PLATFORMS,raw.platform), 'Unknown snapshot platform');
  must(raw.region==='DE', 'This starter accepts Germany only');
  must(isObject(raw.coverage), 'Coverage required');
  const expected=raw.coverage.expected, count=raw.coverage.count;
  must(expected==null || Number.isInteger(expected)&&expected>=0,'Invalid expected count');
  must(Number.isInteger(count)&&count>=0,'Invalid count');
  const complete=raw.coverage.complete===true && expected!==null && count===expected && !(raw.coverage.invalid>0) && !(raw.coverage.errors?.length>0);
  const evidence=(raw.evidence||[]).map(normalizeEvidence);
  const evidenceById=new Map(evidence.map(e=>[e.id,e]));
  must(evidenceById.size===evidence.length,'Duplicate evidence IDs');
  const products=(raw.products||[]).map(normalizeProduct);
  const keys=new Set(products.map(p=>p.key)); must(keys.size===products.length,'Duplicate product IDs');
  function checkEvidence(ids) { for(const id of ids) must(evidenceById.has(id),`Missing evidence: ${id}`); }
  for(const p of products) { must(p.platform===raw.platform,'Cross-platform product in snapshot');checkEvidence(p.evidenceIds);if(p.releaseDate!=null)must(dateOnly(p.releaseDate),'Invalid release date'); }
  const offers=(raw.offers||[]).map(normalizeOffer);
  const entitlements=(raw.entitlements||[]).map(normalizeEntitlement);
  for(const item of [...offers,...entitlements]) { must(keys.has(item.productKey),'Unknown product reference');checkEvidence(item.evidenceIds); }
  for(const e of entitlements) {
    const p=products.find(p=>p.key===e.productKey);
    must(e.targets.every(t=>p.targets.includes(t)),'Entitlement target not supported by product');
    must(e.region==='DE','Wrong entitlement region');
    for(const v of [e.availableFrom,e.availableUntil]) if(v!=null)must(dateOnly(v),'Invalid entitlement date');
  }
  return {schemaVersion:1,platform:raw.platform,region:raw.region,checkedAt:iso(raw.checkedAt,'checkedAt'),
    coverage:{...raw.coverage,complete},products,offers,entitlements,evidence};
}
export function offerDiscount(offer) {
  if(offer.regularPriceMinor==null || offer.regularPriceMinor<=0) return null;
  return Math.round((1-offer.priceMinor/offer.regularPriceMinor)*100);
}
export function berlinDate(value=new Date()) {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
}
export function datedEventBadge(event, now=new Date()) {
  if (!event || !event.verified || !event.eventDate || !dateOnly(event.eventDate)) return 'AKTUELL';
  const today=berlinDate(now);
  if(event.eventDate===today) return event.kind==='deadline'?'HEUTE RELEVANT':'HEUTE NEU';
  const label=event.eventDate.slice(8)+'.'+event.eventDate.slice(5,7)+'.';
  return event.eventDate>today?'AB '+label:'SEIT '+label;
}
export function activeOffer(offer, now=new Date()) {
  const t=now.getTime();
  return (!offer.validFrom || Date.parse(offer.validFrom)<=t) && (!offer.validUntil || t<Date.parse(offer.validUntil));
}
export function entitlementAvailable(e, target, now=new Date()) {
  const today=berlinDate(now);
  return e.targets.includes(target) && (!e.availableFrom||e.availableFrom<=today) && (!e.availableUntil||today<=e.availableUntil);
}
