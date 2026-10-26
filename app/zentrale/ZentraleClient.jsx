'use client';
import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {TAB_IDS,RULES_KEY,searchKey,findEntries,evaluateRules,normalizeRules} from '../../lib/radar-zentrale.mjs';
import {calendarIcs} from '../../lib/radar-calendar-export.mjs';

const WATCHLIST_KEY='psradar_watchlist_v1';
const euro=value=>Number.isFinite(value)?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value):'—';
const day=value=>{if(!value)return 'Unbekannt';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00Z':value);return Number.isFinite(d.getTime())?d.toLocaleDateString('de-DE',{day:'2-digit',month:'short',year:'numeric'}):'Unbekannt'};
function readJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v===null?fallback:v}catch{return fallback}}
function activePrice(entry){return Number.isFinite(entry?.signal?.currentPrice)&&entry.signal.activeDeal?entry.signal.currentPrice:null}
const kinds=[['all','Alle'],['psplus','PS+'],['xbox','Xbox'],['price','Preise'],['archive','Archiv'],['news','News'],['personal','Meine Spiele']];
const tabs=[['heute','Für dich'],['suche','Suche'],['kalender','Kalender'],['preise','Preisregeln'],['quellen','Quellen']];
const icon={psplus:'PS+',xbox:'X',price:'€',archive:'A',news:'N',personal:'★'};

export default function ZentraleClient({index=[],events=[],sources=[],priceGames={},archiveCount=0,bulletin={},catalogChanges=[]}){
 const [tab,setTab]=useState('heute');
 const [query,setQuery]=useState('');
 const [kind,setKind]=useState('all');
 const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
 const [eventKind,setEventKind]=useState('all');
 const [wishlist,setWishlist]=useState([]);
 const [rules,setRules]=useState([]);
 const [manual,setManual]=useState([]);
 const [notes,setNotes]=useState({});
 const [ruleTitle,setRuleTitle]=useState('');
 const [ruleLimit,setRuleLimit]=useState('30');
 const [message,setMessage]=useState('');
 const [limit,setLimit]=useState(36);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search),v=params.get('tab'),q=params.get('q');
  if(TAB_IDS.includes(v))setTab(v);
  if(q){setQuery(q);setTab('suche')}
  const priceGame=params.get('game');if(priceGame&&priceGames[priceGame]){setRuleTitle(priceGame);setTab('preise')}
  const sync=()=>{
   const raw=readJson(WATCHLIST_KEY,[]);
   setWishlist(Array.isArray(raw)?raw.filter(x=>typeof x==='string'||x&&typeof x.title==='string').map(x=>typeof x==='string'?{title:x}:x).slice(0,500):[]);
   setRules(normalizeRules(readJson(RULES_KEY,[])));
   const games=readJson('psn-custom-games-v1',[]);
   setManual(Array.isArray(games)?games.filter(g=>g&&typeof g.name==='string').slice(0,400):[]);
   const saved=readJson('psn-game-planner-v1',{});
   setNotes(saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{});
  };
  sync();
  window.addEventListener('storage',sync);
  window.addEventListener('psradar-watchlist',sync);
  window.addEventListener('psn-profile-local-change',sync);
  return()=>{window.removeEventListener('storage',sync);window.removeEventListener('psradar-watchlist',sync);window.removeEventListener('psn-profile-local-change',sync)};
 },[]);
 const localEntries=useMemo(()=>{
  const entries=manual.map(g=>({id:'personal:'+g.titleId,title:g.name,kind:'personal',subtitle:'Manuell vorgemerkt',url:'/mein-playstation?view=games'}));
  for(const [id,n] of Object.entries(notes)){
   if(!n?.status||entries.some(x=>x.id==='personal:'+id))continue;
   const found=index.find(x=>searchKey(x.title)===searchKey(id)||x.id===id);
   if(found)entries.push({id:'personal:'+id,title:found.title,kind:'personal',subtitle:'Mein Spielplan: '+n.status,url:'/mein-playstation?view=games'});
  }
  return entries;
 },[manual,notes,index]);
 const all=useMemo(()=>[...index,...localEntries], [index,localEntries]);
 const deferred=useDeferredValue(query);
 const results=useMemo(()=>findEntries(all,deferred,kind==='personal'?'personal':kind,120),[all,deferred,kind]);
 const priced=useMemo(()=>Object.entries(priceGames).sort((a,b)=>a[0].localeCompare(b[0],'de')),[priceGames]);
 const checks=useMemo(()=>evaluateRules(rules,priceGames),[rules,priceGames]);
 const matched=checks.filter(r=>r.matched);
 const timed=useMemo(()=>events.filter(e=>e.date.startsWith(month)&&(eventKind==='all'||e.type===eventKind)),[events,month,eventKind]);
 const earliest=useMemo(()=>events.filter(e=>e.date>=new Date().toISOString().slice(0,10)).slice(0,6),[events]);
 const followed=useMemo(()=>wishlist.map(x=>{
  const signal=priceGames[x.title]?.signal;
  return {...x,signal,price:activePrice(priceGames[x.title]),low:priceGames[x.title]?.low??null};
 }),[wishlist,priceGames]);
 const recentlyAdded=useMemo(()=>catalogChanges.filter(c=>c.kind==='added').slice(-6).reverse(),[catalogChanges]);
 const monthRange=useMemo(()=>{
  const out=[];
  for(let offset=-6;offset<=9;offset++){
   const d=new Date();d.setUTCDate(15);d.setUTCMonth(d.getUTCMonth()+offset);
   out.push(d.toISOString().slice(0,7));
  }
  return out;
 },[]);
 function switchTab(v){setTab(v);setLimit(36);const url=new URL(window.location.href);url.searchParams.set('tab',v);if(v!=='suche')url.searchParams.delete('q');history.replaceState(null,'',url)}
 function updateRules(next){
  const safe=normalizeRules(next);
  try{localStorage.setItem(RULES_KEY,JSON.stringify(safe));setRules(safe);setMessage('Preisregel lokal gespeichert. Geprüft wird beim Öffnen der Radar-Zentrale.') }catch{setMessage('Konnte Preisregel nicht speichern.')}
 }
 function addRule(){
  const price=Number(String(ruleLimit).replace(',','.'));
  if(!priceGames[ruleTitle]){setMessage('Bitte einen im Preisradar beobachteten Titel auswählen.');return}
  if(!Number.isFinite(price)||price<0||price>10000){setMessage('Bitte einen gültigen Zielpreis angeben.');return}
  const filtered=rules.filter(r=>r.title!==ruleTitle);
  updateRules([...filtered,{title:ruleTitle,limit:price,enabled:true}]);
  setRuleTitle('');
 }
 function storeNewMonth(d){setMonth(d);setLimit(36)}
 function exportCurrentCalendar(){
  if(!timed.length)return;
  const blob=new Blob([calendarIcs(timed,new Date())],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='psradar-termine-'+month+'.ics';document.body.append(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 const backlog=Object.values(notes).filter(x=>x&&x.status).length;
 return <main className="rz-shell"><div className="rz-page">
  <header className="rz-head"><span className="rz-kicker">PLAYSTATION RADAR · COMMAND CENTER</span><h1>Deine Radar-Zentrale</h1>
   <p>Suche, Wunschliste, Kalender und Quellenstatus an einem Ort. Daten bleiben nach Plattform und Edition getrennt – ohne eine neue Spielakte.</p>
   <div className="rz-head-stats">
    <span><strong>{index.filter(g=>g.kind==='psplus').length}</strong> PS+-Einträge</span>
    <span><strong>{index.filter(g=>g.kind==='xbox').length}</strong> Xbox-Produkte</span>
    <span><strong>{wishlist.length}</strong> gemerkt</span>
    <span><strong>{backlog}</strong> Spielpläne</span>
   </div>
  </header>
  <nav className="rz-tabs" aria-label="Radar-Zentrale Ansichten">{tabs.map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>switchTab(id)}>{label}{id==='preise'&&matched.length?<span className="rz-count">{matched.length}</span>:null}</button>)}</nav>
  {tab==='heute'?<div className="rz-feed">
   <section className="rz-feature">
    {bulletin.image?<img src={bulletin.image} alt="" loading="lazy" decoding="async"/>:null}
    <div className="rz-feature-copy"><span className="rz-kicker">{bulletin.edition||'RADAR'} · AKTUELLE AUSGABE</span><h2>{bulletin.headline||'Dein Gaming-Überblick'}</h2><p>Dein persönlicher Startpunkt für neue Katalogspiele, gespeicherte Angebote und offene Pläne.</p><a href="/radar">Aktuelle Ausgabe ansehen</a></div>
   </section>
   <div className="rz-tiles">
    <article className="rz-card"><span className="rz-kicker">PREISE BEOBACHTEN</span><h3>{followed.length} Spiele auf deiner Watchlist</h3>
     {followed.length?<ul>{followed.slice(0,5).map(g=><li key={g.title}><span>{g.title}</span><strong>{g.price!==null?euro(g.price):'Kein aktueller Deal'}</strong></li>)}</ul>:<p>Merke Spiele über das Detailfenster im Radar. Deine Watchlist wird hier berücksichtigt.</p>}
     <button onClick={()=>switchTab('preise')}>Preisziele verwalten</button></article>
    <article className="rz-card"><span className="rz-kicker">DEINE SAMMLUNG</span><h3>{backlog} persönliche Spielpläne</h3><p>Setze bestehende Platin-Projekte und Sammlungen fort. PSN-Spielzeiten werden hier nicht geschätzt.</p><a href="/mein-playstation?view=games">Meine Spielwelt öffnen</a></article>
    <article className="rz-card"><span className="rz-kicker">DEIN GAMING-MAGAZIN</span><h3>Persönliche Ausgabe und Sammlungs-Museum</h3><p>Dein persönlicher Monatsrückblick lässt sich als PDF drucken. Das Museum zeigt lokal gespeicherte Sammlungen und Cover.</p><div className="rz-card-links"><a href="/magazin">Mein Gaming-Magazin</a><a href="/museum">Sammlungs-Museum</a></div></article>
    <article className="rz-card"><span className="rz-kicker">PS+ NEU ERFASST</span><h3>Aktuelle Katalogänderungen</h3><ul>{recentlyAdded.length?recentlyAdded.map(x=><li key={x.id+'-'+x.date}><span>{x.title}</span><small>{day(x.date)}</small></li>):<li>Keine neu erfassten Titel im aktuellen Datensatz.</li>}</ul><a href="/ps-plus">Katalog öffnen</a></article>
    <article className="rz-card"><span className="rz-kicker">BEVORSTEHENDE TERMINE</span><h3>Kalender-Vorschau</h3><ul>{earliest.length?earliest.map(x=><li key={x.id}><span>{x.title}</span><small>{day(x.date)}</small></li>):<li>Derzeit keine bestätigten zukünftigen Termine hinterlegt.</li>}</ul><button onClick={()=>switchTab('kalender')}>Kalender öffnen</button></article>
   </div>
   <div className="rz-tiles rz-experience-tiles">
    <article className="rz-card"><span className="rz-kicker">GAMING-MUSEUM</span><h3>Deine virtuelle Sammlung</h3><p>Individuelle Cover-Galerie, Franchise-Sammlungen und deine Platin-Ziele als Ausstellung.</p><a href="/museum">Museum besuchen</a></article>
    <article className="rz-card"><span className="rz-kicker">PERSONAL EDITION</span><h3>Mein Gaming-Magazin</h3><p>Deine persönlichen Monatsausgaben mit Spielplänen und lokal belegten Fortschritten. Im Browser als PDF druckbar.</p><a href="/magazin">Monatsmagazin gestalten</a></article>
   </div>
   {matched.length?<aside className="rz-matches" role="status"><strong>{matched.length} lokale Preisregel{matched.length===1?' erfüllt':'n erfüllt'}</strong><p>Aktuell erfasste aktive Angebote erreichen deinen selbst gewählten Zielpreis.</p><button onClick={()=>switchTab('preise')}>Treffer anzeigen</button></aside>:null}
  </div>:null}
  {tab==='suche'?<section className="rz-panel"><div className="rz-panel-heading"><h2>Alles durchsuchen</h2><p>PS+, Xbox, Preise, Magazin-Archiv und lokal vorgemerkte Spiele. Einzelne Editionen bleiben separate Treffer.</p></div>
   <label className="rz-searchbox"><span className="rz-sr-only">Suchbegriff</span><input autoFocus type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(36);const u=new URL(location.href);u.searchParams.set('q',e.target.value);u.searchParams.set('tab','suche');history.replaceState(null,'',u)}} placeholder="Spiel, Franchise, Magazinmeldung …"/></label>
   <div className="rz-filters" role="group" aria-label="Suchbereich">{kinds.map(([v,label])=><button type="button" key={v} aria-pressed={kind===v} onClick={()=>setKind(v)}>{label}</button>)}</div>
   <p className="rz-muted" role="status">{query.trim().length<2?'Mindestens zwei Zeichen eingeben':results.length+' Treffer'+(results.length===120?' (Anzeige begrenzt)':'')}</p>
   {query.trim().length>=2&&!results.length?<div className="rz-empty">Keine passenden Titel im aktuellen Datenbestand.</div>:null}
   <div className="rz-results">{results.slice(0,limit).map(x=><article className="rz-result" key={x.id}>
    {x.image?<img src={x.image} alt="" loading="lazy" decoding="async" onError={e=>{e.currentTarget.style.display='none'}}/>:<span className="rz-placeholder">{icon[x.kind]||'★'}</span>}
    <div><small>{x.kind.toUpperCase()} · {x.subtitle}</small><h3>{x.title}</h3>{Number.isFinite(x.price)?<span>{euro(x.price)}{x.kind==='price'?' · aktuell bestätigter Deal':''}</span>:null}</div>
    <a href={x.url}>Öffnen</a>
   </article>)}</div>
   {results.length>limit?<button className="rz-more" type="button" onClick={()=>setLimit(n=>n+36)}>Weitere Ergebnisse ({results.length-limit})</button>:null}
  </section>:null}
  {tab==='kalender'?<section className="rz-panel"><div className="rz-panel-heading"><h2>Gaming-Kalender</h2><p>Katalogänderungen, bestätigte Abgänge und verfügbare Termine. Keine geschätzten Releases oder erfundenen PS+-Ablauffristen.</p></div>
   <div className="rz-date-controls"><label>Monat<select value={month} onChange={e=>storeNewMonth(e.target.value)}>{monthRange.map(m=><option value={m} key={m}>{new Date(m+'-15T12:00:00Z').toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</option>)}</select></label>
   <label>Ereignis<select value={eventKind} onChange={e=>setEventKind(e.target.value)}><option value="all">Alle</option><option value="catalog-added">Katalogzugänge</option><option value="catalog-removed">Entfernung festgestellt</option><option value="catalog-leaving">Angekündigter Abgang</option><option value="sale-ending">Sale-Ende</option><option value="release">Release</option></select></label></div>
   <div className="rz-calendar-export"><button type="button" onClick={exportCurrentCalendar} disabled={!timed.length}>Termine dieses Monats als .ics exportieren</button><small>Statischer Kalenderexport – keine automatische Aktualisierung</small></div>
   <div className="rz-event-list">{timed.length?timed.slice(0,limit).map(e=><a href={e.url} key={e.id} className="rz-event"><time dateTime={e.date}>{day(e.date)}</time><span><strong>{e.title}</strong><small>{e.subtitle}</small></span><span aria-hidden="true">↗</span></a>):<div className="rz-empty">Für diesen Monat und Filter liegen keine bestätigten Daten vor.</div>}</div>
   {timed.length>limit?<button type="button" className="rz-more" onClick={()=>setLimit(x=>x+36)}>Weitere Termine anzeigen</button>:null}
   <p className="rz-muted">„Entfernung festgestellt“ bedeutet: Ein Spiel wurde beim Katalogvergleich nicht mehr gefunden. Das ist nicht automatisch das Datum, an dem Sony das Spiel entfernt hat.</p>
  </section>:null}
  {tab==='preise'?<section className="rz-panel"><div className="rz-panel-heading"><h2>Preisziele & lokale Alarme</h2><p>Lege Preisgrenzen fest. Der Abgleich erfolgt mit den gespeicherten Radar-Daten beim Öffnen dieser Seite. Keine Push-, Telegram- oder E-Mail-Zustellung ohne zusätzliche Integration.</p></div>
   <div className="rz-rule-editor"><label>Spiel im Preisradar<select value={ruleTitle} onChange={e=>setRuleTitle(e.target.value)}><option value="">Titel auswählen …</option>{priced.map(([t])=><option key={t} value={t}>{t}</option>)}</select></label><label>Maximalpreis in €<input inputMode="decimal" value={ruleLimit} onChange={e=>setRuleLimit(e.target.value)} aria-label="Zielpreis in Euro"/></label><button type="button" onClick={addRule}>Preisregel speichern</button></div>
   {message?<p role="status" className="rz-message">{message}</p>:null}
   <div className="rz-rules">{checks.map(x=><article key={x.title} className={'rz-rule'+(x.matched?' is-hit':'')}>
    <div><strong>{x.title}</strong><small>Ziel: {euro(x.limit)} · {x.price!==null?'Aktueller verifizierter Preis '+euro(x.price):'Kein derzeit verifizierter Preis'} </small></div>
    <span>{x.matched?'Preisziel erreicht':x.checked?'Preisziel nicht erreicht':'Noch nicht prüfbar'}</span>
    <button onClick={()=>updateRules(rules.filter(r=>r.title!==x.title))} aria-label={'Preisregel für '+x.title+' entfernen'}>Entfernen</button>
   </article>)}{!checks.length?<div className="rz-empty">Noch keine Preisregeln gespeichert.</div>:null}</div>
   <h3>Beobachtete Store-Titel</h3><div className="rz-price-grid">{priced.map(([title,g])=><article key={title} className="rz-price-card">
    <strong>{title}</strong><small>{activePrice(g)!==null?'Aktuell verifizierter Preis: '+euro(activePrice(g)):'Kein verifizierter aktiver Deal'}</small><small>Historischer Tiefstwert: {euro(g.low)}</small><div>{g.storeUrl?<a href={g.storeUrl} target="_blank" rel="noopener noreferrer">Store</a>:null}<button type="button" onClick={()=>{setRuleTitle(title);setMessage('Titel für eine Preisregel ausgewählt. Lege oben den Zielpreis fest.')}}>Preisziel setzen</button></div>
   </article>)}</div>
   <p className="rz-muted">Diese historischen Werte ersetzen keine Live-Shop-Abfrage. Plattformübergreifende Preise werden nicht automatisch gleichgesetzt, weil Editionen und Angebote abweichen können.</p>
  </section>:null}
  {tab==='quellen'?<section className="rz-panel"><div className="rz-panel-heading"><h2>Datenqualität & Quellen</h2><p>Was das Radar tatsächlich weiß – und wo Ergebnisse lückenhaft oder älter sind.</p></div>
   <div className="rz-source-grid">{sources.map(x=><article key={x.name} className="rz-source"><div><strong>{x.name}</strong><span className={x.complete?'rz-complete':'rz-partial'}>{x.complete?'Als vollständig gemeldet':'Eingeschränkt / prüfen'}</span></div><p>{x.detail}</p><dl><dt>Letzter Datenstand</dt><dd>{day(x.date)}</dd><dt>Erfasste Einträge</dt><dd>{x.count??'Nicht angegeben'}</dd></dl></article>)}</div>
   <p className="rz-muted">„Vollständig“ bezeichnet ausschließlich den von der jeweiligen Pipeline gemeldeten Status. Unbekannte oder veraltete Drittanbieter-Informationen können weiterhin fehlen.</p>
   <div className="rz-source-actions"><a href="/ps-plus">PS+-Daten prüfen</a><a href="/xbox">Xbox Beta prüfen</a><a href="/preise">Preisverlauf prüfen</a><a href="/archive">Archiv ({archiveCount})</a></div>
  </section>:null}
 </div></main>;
}
