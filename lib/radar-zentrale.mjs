// Cross-section discovery without fuzzy game/edition merging.
export const RULES_KEY='psradar_alert_rules_v1';
export const READ_KEY='psradar_alert_seen_v1';
export const TAB_IDS=['heute','suche','kalender','preise','quellen'];

export function searchKey(value){
 return String(value||'').normalize('NFKD').toLocaleLowerCase('de').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
export function buildIndex({catalog={},xbox={},prices={},archive=[],radar={}}={}){
 const entries=[];
 for(const g of Array.isArray(catalog.games)?catalog.games:[]){
  if(!g.title)continue;
  entries.push({id:'psplus:'+g.id,title:g.title,kind:'psplus',subtitle:(g.services||[]).join(' / ')||'PS+ Katalog',url:'/ps-plus?tab='+encodeURIComponent(g.services?.includes('extra')?'extra':g.services?.includes('ubisoft')?'ubisoft':g.services?.includes('essential')?'essential':'premium')+'&q='+encodeURIComponent(g.title),image:g.image||null,release:g.releaseDate||null,leavingAt:g.leavingAt||null,storeUrl:g.storeUrl||null});
 }
 for(const g of Array.isArray(xbox.games)?xbox.games:[]){
  if(!g.title)continue;
  entries.push({id:'xbox:'+g.id,title:g.title,kind:'xbox',subtitle:(g.services||[]).join(' / ')||'Xbox',url:'/xbox?q='+encodeURIComponent(g.title),image:g.cover||null,price:Number.isFinite(g.priceMinor)?g.priceMinor/100:null,storeUrl:g.storeUrl||null});
 }
 for(const g of Object.values(prices.games||{})){
  if(!g?.title)continue;
  const signal=g.signal||{};
  entries.push({id:'price:'+g.title,title:g.title,kind:'price',subtitle:signal.activeDeal?'Verifiziertes aktives Angebot':'Preisverlauf',url:'/preise',image:g.image||null,price:signal.activeDeal&&Number.isFinite(signal.currentPrice)?signal.currentPrice:null,low:Number.isFinite(signal.radarLow)?signal.radarLow:null,storeUrl:g.storeUrl||null});
 }
 for(const a of Array.isArray(archive)?archive:[]){
  entries.push({id:'archive:'+a.id,title:a.lead||a.headline||a.edition||'Magazinausgabe',kind:'archive',subtitle:a.edition+' · '+a.date,url:'/archive/'+encodeURIComponent(a.id),image:a.image||null,date:a.date});
 }
 for(const [id,title] of [['headline',radar.leadTitle],['secondary1',radar.secondary1Title],['secondary2',radar.secondary2Title]]){
  if(title)entries.push({id:'news:'+id,title,kind:'news',subtitle:'Aktuelle Radar-Ausgabe',url:'/radar',image:id==='headline'?radar.leadImage:radar[id+'Image']||null});
 }
 return entries;
}
export function findEntries(index=[],query='',kind='all',limit=60){
 const q=searchKey(query);
 if(q.length<2)return [];
 const tokens=q.split(' ').filter(Boolean);
 return index.filter(v=>(kind==='all'||v.kind===kind)&&tokens.every(t=>searchKey(v.title).includes(t))).sort((a,b)=>{
  const ak=searchKey(a.title),bk=searchKey(b.title);
  const rank=x=>x===q?0:x.startsWith(q)?1:2;
  return rank(ak)-rank(bk)||a.title.localeCompare(b.title,'de');
 }).slice(0,limit);
}
export function buildEvents({catalog={},radar={},today=new Date()}={}){
 const events=[];
 const add=(raw,title,type,url,subtitle)=>{
  if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(raw))return;
  const day=raw.slice(0,10),date=new Date(day+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)return;
  events.push({id:type+':'+title+':'+day,date:day,title,type,url,subtitle});
 };
 for(const c of catalog.changes||[]){
  if(!c.title||!['added','removed'].includes(c.kind))continue;
  add(c.date,c.title,c.kind==='added'?'catalog-added':'catalog-removed','/ps-plus',c.kind==='added'?'PS+-Katalog: neu erfasst':'PS+-Katalog: Entfernung festgestellt');
 }
 for(const g of catalog.games||[]){
  if(g.leavingAt)add(g.leavingAt,g.title,'catalog-leaving','/ps-plus','Angekündigte Katalogentfernung');
 }
 if(radar.storeEnd)add(radar.storeEnd,'Aktuelle Store-Aktion endet','sale-ending','/preise','Enddatum der im Radar erfassten Aktion');
 for(const rel of radar.releases||[]){
  if(rel?.date&&rel.title)add(rel.date,rel.title,'release','/radar','Veröffentlichungsdatum laut Radar');
 }
 return [...new Map(events.map(e=>[e.id,e])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-240);
}
export function normalizeRules(raw){
 if(!Array.isArray(raw))return [];
 const result=[];
 for(const v of raw.slice(0,200)){
  const title=String(v?.title||'').trim().slice(0,120),limit=Number(v?.limit);
  if(title.length<2||!Number.isFinite(limit)||limit<0||limit>10000||result.some(x=>x.title===title))continue;
  result.push({title,limit:Math.round(limit*100)/100,enabled:v.enabled!==false});
 }
 return result.slice(0,80);
}
export function evaluateRules(rules,prices){
 return normalizeRules(rules).map(r=>{
  const signal=prices?.[r.title]?.signal;
  const verified=Boolean(signal?.activeDeal&&Number.isFinite(signal.currentPrice));
  const price=verified?Number(signal.currentPrice):null;
  return {...r,price,matched:r.enabled&&price!==null&&price<=r.limit,checked:verified};
 });
}
export function sourceSummary({catalog={},xbox={},prices={},radar={}}={}){
 return [
  {name:'PlayStation-Magazin',date:radar.health?.checkedAt||radar.sourceCheck?.checkedAt||null,complete:radar.health?.status==='ok',count:radar.health?.enrichedTitles??null,detail:radar.health?.status||'Status unbestätigt'},
  {name:'PS+-Katalog',date:catalog.checkedAt||null,complete:Object.values(catalog.sections||{}).every(s=>s.complete),count:catalog.games?.length??null,detail:'Sektionen mit eigener Vollständigkeitsprüfung'},
  {name:'Xbox Beta',date:xbox.checkedAt||null,complete:!!xbox.coverage?.complete,count:xbox.games?.length??null,detail:'Einzelne Dienste können unvollständig sein'},
  {name:'Preisradar',date:prices.updatedAt||null,complete:false,count:Object.keys(prices.games||{}).length,detail:'Historische Radar-Messungen, keine flächendeckende Live- oder Händlerpreisabdeckung. Aktive Deals separat verifizieren.'}
 ];
}
