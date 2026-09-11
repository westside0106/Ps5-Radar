import { activeOffer, entitlementAvailable } from './model.mjs';
export function selectProducts(snapshot,{target=null,query='',type=null}={}) {
  const q=query.trim().toLocaleLowerCase('de-DE');
  return snapshot.products.filter(p=>(!target||p.targets.includes(target))&&(!type||p.productType===type)&&(!q||p.title.toLocaleLowerCase('de-DE').includes(q)));
}
export function selectOffers(snapshot,{target=null,now=new Date()}={}) {
  const products=new Map(snapshot.products.map(p=>[p.key,p]));
  return snapshot.offers.filter(o=>activeOffer(o,now)&&(!target||products.get(o.productKey)?.targets.includes(target)));
}
export function selectEntitlements(snapshot,{serviceId=null,tierId=null,target=null,now=new Date()}={}) {
  return snapshot.entitlements.filter(e=>(!serviceId||e.serviceId===serviceId)&&(!tierId||e.tierId===tierId)&&(!target||entitlementAvailable(e,target,now)));
}
export function sourceHealth(snapshot,now=new Date(),maxAgeHours=48) {
  const ageHours=(now.getTime()-Date.parse(snapshot.checkedAt))/3600000;
  return {complete:snapshot.coverage.complete,stale:!Number.isFinite(ageHours)||ageHours>maxAgeHours||ageHours < -1,
    count:snapshot.coverage.count,expected:snapshot.coverage.expected,errors:snapshot.coverage.errors||[],checkedAt:snapshot.checkedAt};
}
// Never derive personal ownership from a public catalog snapshot.
export function publicAccessLabel(e) {
  return ({claim:'Im angegebenen Zeitraum beanspruchbar',catalog:'Über das angegebene Abo verfügbar',trial:'Zeitlich begrenzter Testzugang',owned:'Besitz separat bestätigt',free:'Kostenlos verfügbar'})[e.accessKind];
}
