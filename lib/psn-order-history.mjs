// Read-only import of PS Order History+ CSV/JSON exports.
// Aggregation is browser-local; do not persist transaction identifiers or payment methods.
const LABELS={purchased:'Gekauft',psplus:'PS Plus',free:'Kostenlos',subscription:'Abonnements',voucher:'Codes/Gutscheine',other:'Sonstige'};
const aliases={
 purchased:'purchased',psplus:'psplus',free:'free',subscriptions:'subscription',
 subscription:'subscription','codes & vouchers':'voucher',voucher:'voucher',
 other:'other'
};
const MAX_ITEMS=15000;
function dateOnly(value){
 if(typeof value!=='string')return null;
 const d=value.trim().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;
 const parsed=new Date(d+'T12:00:00Z');
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===d?d:null;
}
function valueMoney(raw){
 if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0&&raw<1e8?Math.round((raw+Number.EPSILON)*100)/100:null;
 if(typeof raw!=='string')return null;
 let s=raw.trim().replace(/\s|\u00a0/g,'').replace(/^(?:€|\$|£|₹)/,'').replace(/(?:€|\$|£|₹)$/,'');
 if(!s)return null;
 if(/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(s))s=s.replace(/,/g,'');
 else if(/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');
 else if(/^\d+,\d{1,2}$/.test(s))s=s.replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;
 const n=Number(s);
 return Number.isFinite(n)&&n>=0&&n<1e8?Math.round(n*100)/100:null;
}
function normalizeCategory(value){
 const key=String(value||'').trim().toLowerCase().replace(/[ _-]+/g,'');
 return aliases[key]||aliases[String(value||'').trim().toLowerCase()]||null;
}
function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 const source=text.replace(/^\ufeff/,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){
   if(quoted&&source[i+1]==='"'){field+='"';i++;}
   else if(!quoted&&!field)quoted=true;
   else if(quoted)quoted=false;
   else throw new Error('CSV enthält ein falsch platziertes Anführungszeichen.');
  }else if(c===','&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field);if(row.some(v=>v!==''))rows.push(row);row=[];field='';}
  else field+=c;
  if(rows.length>MAX_ITEMS+1)throw new Error('Import zu groß: höchstens '+MAX_ITEMS+' Positionen.');
 }
 if(quoted)throw new Error('CSV ist unvollständig: offene Anführungszeichen.');
 row.push(field);if(row.some(v=>v!==''))rows.push(row);
 if(rows.length<2)throw new Error('CSV enthält keine Bestellpositionen.');
 const header=rows.shift().map(s=>s.trim().replace(/^\ufeff/,'').toLowerCase());
 for(const col of ['date','name','category','price paid','refunded'])if(!header.includes(col))throw new Error('CSV-Spalte fehlt: '+col+'. Bitte PS Order History+ exportieren.');
 const col=name=>header.indexOf(name);
 const objects=rows.map(cols=>({
  date:cols[col('date')],name:cols[col('name')],category:cols[col('category')],
  paid:cols[col('price paid')],original:cols[col('store price')],
  refunded:cols[col('refunded')],sku:cols[col('sku')],
  txnId:cols[col('transaction id')],platforms:cols[col('platform')],type:cols[col('type')]
 }));
 return objects;
}
function normalizeRow(row){
 if(!row||typeof row!=='object'||Array.isArray(row))return null;
 const date=dateOnly(row.date);
 const title=String(row.name||'').trim().slice(0,180);
 const category=normalizeCategory(row.category);
 if(!date||!title||!category)return null;
 const paid=valueMoney(row.paid);
 const original=valueMoney(row.original);
 const refunded=String(row.refunded||'').toLowerCase()==='yes'||String(row.refunded||'').toLowerCase()==='true';
 return {date,title,category,paid,original,refunded,platform:String(row.platforms||'').slice(0,75)};
}
export function parseOrderHistory(text,format='auto'){
 if(typeof text!=='string'||!text.trim()||text.length>3_000_000)throw new Error('Die Importdatei ist leer oder größer als 3 MB.');
 const json=format==='json'||(format==='auto'&&text.trimStart().startsWith('['));
 let raw;
 if(json){
  let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('Ungültiges JSON. Bitte einen vollständigen PS Order History+-Export wählen.');}
  raw=Array.isArray(parsed)?parsed:Array.isArray(parsed?.rows)?parsed.rows:null;
  if(!raw)throw new Error('JSON enthält keine Liste von Bestellpositionen.');
 }else raw=parseCsv(text);
 if(!raw.length||raw.length>MAX_ITEMS)throw new Error('Keine Positionen oder mehr als '+MAX_ITEMS+' Einträge.');
 const rows=[];const seen=new Set();
 for(const record of raw){
  const data=normalizeRow(record);
  if(!data)continue;
  const id=typeof record.id==='string'&&record.id.length<200?record.id:null;
  if(id){if(seen.has(id))continue;seen.add(id);}
  rows.push(data);
 }
 if(!rows.length)throw new Error('Keine gültigen Positionen mit Datum, Titel und Kategorie gefunden.');
 return {rows,sourceRows:raw.length,skippedRows:raw.length-rows.length,source:json?'json':'csv'};
}
export function summarizeOrderHistory(rows=[]){
 const groups=Object.fromEntries(Object.keys(LABELS).map(k=>[k,{count:0,paid:0,storeValue:0}]));
 const monthly=new Map();let spent=0,refundedCount=0,unknownAmounts=0,paidOrders=0;
 for(const r of Array.isArray(rows)?rows:[]){
  if(!r||!groups[r.category])continue;
  const g=groups[r.category];g.count++;
  const charge=typeof r.paid==='number'&&!r.refunded?r.paid:0;
  if(r.paid===null)unknownAmounts++;
  if(r.refunded)refundedCount++;
  if(charge>0)paidOrders++;
  g.paid+=charge;g.storeValue+=r.original??0;
  spent+=charge;
  const key=r.date.slice(0,7),existing=monthly.get(key)||{month:key,paid:0,positions:0};
  existing.paid+=charge;existing.positions++;
  monthly.set(key,existing);
 }
 const money=n=>Math.round((n+Number.EPSILON)*100)/100;
 return {
  positions:rows.length,netSpent:money(spent),refundedCount,unknownAmounts,paidOrders,
  groups:Object.fromEntries(Object.entries(groups).map(([k,g])=>[k,{count:g.count,paid:money(g.paid),storeValue:money(g.storeValue),label:LABELS[k]}])),
  monthly:[...monthly.values()].sort((a,b)=>b.month.localeCompare(a.month)).slice(0,18).map(m=>({...m,paid:money(m.paid)})),
  latest:[...rows].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12)
 };
}
