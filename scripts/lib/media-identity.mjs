import { titleKey, storeIdentity, verifiedImage, catalogCover } from '../../lib/ps-plus-catalog.mjs';
const PRODUCT_NOISE=/\b(?:standard|digital|edition|ps4|ps5|playstation|store|kaufen|and|und)\b/g;
function productTitleKey(value){return titleKey(value).replace(PRODUCT_NOISE,' ').replace(/\s+/g,' ').trim();}
export function storeProduct(html){
  const block=String(html||'').match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!block) return null;
  let data; try{data=JSON.parse(block[1]);}catch{return null;}
  const node=[].concat(data&&data['@graph']||data).find(entry=>entry&&entry['@type']==='Product');
  if(!node||!node.sku) return null;
  return {sku:String(node.sku).toUpperCase(),name:String(node.name||''),image:verifiedImage(Array.isArray(node.image)?node.image[0]:node.image)};
}
export function verifiedStoreCover({title,storeUrl,html}){
  const product=storeProduct(html);
  if(!product||!product.image) return null;
  const id=storeIdentity(storeUrl);
  if(!id||id!==`product:${product.sku}`) return null;
  const expected=productTitleKey(title),actual=productTitleKey(product.name);
  return expected&&actual&&actual.includes(expected)?product.image:null;
}
export function titleMatches(a, b) {
  const x = titleKey(a), y = titleKey(b);
  return Boolean(x && y && (x === y || x.replace(/\b(?:standard|digital|edition)\b/g,'').trim() === y.replace(/\b(?:standard|digital|edition)\b/g,'').trim()));
}
export function resolveGameCover({ title, storeUrl, catalog, details = {} }) {
  const catalogImage = catalogCover(catalog, title, storeUrl);
  if (catalogImage) return { image: catalogImage, source: 'official-catalog' };
  const id = storeIdentity(storeUrl);
  if (id && id === storeIdentity(details.storeUrl) && titleMatches(title, details.title || title)) {
    const image = verifiedImage(details.coverImage);
    if (image) return { image, source: 'official-product' };
  }
  return { image: null, source: 'unverified' };
}
export function applyVerifiedPlusCovers(radar, catalog) {
  const previous = radar.gameDetails || {};
  radar.plusGames = (radar.plusGames || []).map(game => {
    const storeUrl = game.storeUrl || radar.resolvedSources?.psPlusStoreUrls?.[game.title] || previous[game.title]?.storeUrl || null;
    const resolved = resolveGameCover({ title: game.title, storeUrl, catalog, details: previous[game.title] || {} });
    return { ...game, storeUrl, image: resolved.image, imageSource: resolved.source };
  });
  return radar;
}
