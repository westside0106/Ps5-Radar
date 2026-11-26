export function normalizePurchases(rows){
 if(!Array.isArray(rows)||rows.length>10000)throw Error('Ungültige Belegliste');
 const result=new Map();
 for(const p of rows){
  if(!p||typeof p.id!=='string'||!p.id.trim()||p.id.length>200||typeof p.title!=='string'||!p.title.trim()||p.title.length>500||!['purchase','free','plus','unknown'].includes(p.kind))throw Error('Ungültiger Beleg');
  if(p.titleId!=null&&(typeof p.titleId!=='string'||p.titleId.length>100))throw Error('Ungültige Titel-ID');
  if(p.date!=null&&(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date))throw Error('Ungültiges Datum');
  if(p.amountCents!=null&&(!Number.isSafeInteger(p.amountCents)||p.amountCents<0||p.amountCents>100000000))throw Error('Ungültiger Betrag');
  if(p.currency!=null&&!/^[A-Z]{3}$/.test(p.currency))throw Error('Ungültige Währung');
  if(p.kind==='purchase'&&(p.amountCents==null||!p.currency))throw Error('Kaufpreis fehlt');
  if(['free','plus'].includes(p.kind)&&p.amountCents!=null&&p.amountCents!==0)throw Error('Zugangsart widerspricht Betrag');
  const record={id:p.id.trim(),title:p.title.trim(),titleId:p.titleId||null,date:p.date||null,kind:p.kind,amountCents:p.amountCents??null,currency:p.currency||null};
  if(result.has(record.id)&&JSON.stringify(result.get(record.id))!==JSON.stringify(record))throw Error('Widersprüchliche Beleg-ID');
  result.set(record.id,record);
 }
 return [...result.values()];
}
export function mergePurchases(existing,incoming){
 return normalizePurchases([...normalizePurchases(existing??[]),...normalizePurchases(incoming??[])]);
}
