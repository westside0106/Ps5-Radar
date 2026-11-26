export const normalizeTitleId=id=>typeof id==='string'?id.trim().toUpperCase().replace(/^((?:PPSA|CUSA)\d{5})_00$/,'$1'):'';
export function financeRows(m){
 const purchases=Array.isArray(m.purchases)?m.purchases:[];
 const valid=purchases.filter(p=>p&&typeof p.id==='string'&&p.id&&['purchase','free','plus','unknown','subscription','deposit','refund'].includes(p.kind));
 const unique=[...new Map(valid.map(p=>[p.id,p])).values()];
 const paid=unique.filter(p=>p.kind==='purchase'&&Number.isSafeInteger(p.amountCents)&&p.amountCents>=0&&p.currency==='EUR');
 const subs=unique.filter(p=>p.kind==='subscription'&&p.currency==='EUR'&&Number.isSafeInteger(p.amountCents));
 const refunds=unique.filter(p=>p.kind==='refund'&&p.currency==='EUR'&&Number.isSafeInteger(p.amountCents));
 const sum=rs=>rs.reduce((s,p)=>s+p.amountCents,0);
 const groups=new Map(),months=new Map();
 for(const p of [...subs,...refunds])if(/^\d{4}-\d{2}-\d{2}$/.test(p.date||'')){const month=p.date.slice(0,7);months.set(month,(months.get(month)||0)+(p.kind==='refund'?-1:1)*p.amountCents);}
 for(const p of paid){
  if(typeof p.titleId==='string'&&p.titleId)groups.set(normalizeTitleId(p.titleId),(groups.get(normalizeTitleId(p.titleId))||0)+p.amountCents);
  if(/^\d{4}-\d{2}-\d{2}$/.test(p.date||'')){const month=p.date.slice(0,7);months.set(month,(months.get(month)||0)+p.amountCents);}
 }
 const games=new Map(); for(const g of m.games){const id=normalizeTitleId(g.id);if(!id)continue;if(games.has(id))games.set(id,null);else games.set(id,g);}
 const ranking=[...groups].map(([id,cents])=>{const g=games.get(id),h=g&&Number.isFinite(g.sonyMinutes)?g.sonyMinutes/60:null;return [g?.title||id,id,cents/100,h,h>0?Math.round(cents/h)/100:null,h===0?'0 Stunden gemeldet':h===null?'Spielzeit unbekannt':'Gespielt'];}).sort((a,b)=>(a[4]??Infinity)-(b[4]??Infinity));
 const known=new Set(unique.map(p=>normalizeTitleId(p.titleId)).filter(Boolean));
 return {
 summary:[['Kennzahl','Wert'],['Erfasste EUR-Käufe',paid.length],['Erfasste EUR-Ausgaben',paid.length?paid.reduce((s,p)=>s+p.amountCents,0)/100:null],['Abonnements EUR',subs.length?sum(subs)/100:null],['Rückerstattungen EUR',refunds.length?sum(refunds)/100:null],['Nettoausgaben EUR',unique.length?(sum(paid)+sum(subs)-sum(refunds))/100:null],['Kostenlose Zugänge',unique.filter(p=>p.kind==='free').length],['PS Plus Zugänge',unique.filter(p=>p.kind==='plus').length],['Bibliothekstitel ohne Zuordnung',m.library.filter(g=>!known.has(normalizeTitleId(g.titleId))).length],['Hinweis','Nur erfasste Käufe; keine vollständige Kontohistorie. Fehlende Preise sind unbekannt.']],
 receipts:[['Beleg-ID','Titel','Titel-ID','Datum','Zugangsart','Betrag','Währung','SKU','Originalpreis','Erstattet'],...unique.map(p=>[p.id,p.title,p.titleId,p.date,p.kind,Number.isSafeInteger(p.amountCents)&&p.amountCents>=0?p.amountCents/100:null,p.currency,p.sku,p.originalCents==null?null:p.originalCents/100,p.refunded?'Ja':'Nein'])],
 ranking:[['Titel','Titel-ID','Titelbezogene Bruttokosten EUR','Sony Stunden','EUR pro Stunde','Status'],...ranking],
 monthly:[['Monat','Nettoausgaben EUR'],...[...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,cents])=>[month,cents/100])]
 };
}
