'use client';
import {useEffect,useState} from 'react';
const euro=n=>Number.isFinite(Number(n))?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)):'—';
const date=s=>s?new Date(s).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'}):'Noch nicht geprüft';
const status={
 matched:'Preisziel erreicht',
 above_target:'Über deinem Zielpreis',
 no_active_deal:'Kein aktuell bestätigter Deal',
 unverified:'Noch nicht geprüft'
};
export default function ServerPriceAlerts({priceGames={},localRules=[],initialTitle='',onRulesChange=()=>{},onLocalSave=()=>{}}){
 const [rules,setRules]=useState([]),[events,setEvents]=useState([]),[state,setState]=useState('loading');
 const [title,setTitle]=useState(initialTitle),[limit,setLimit]=useState('30'),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function request(method='GET',data){
  const r=await fetch('/zentrale/api/price-alerts',{method,credentials:'same-origin',cache:'no-store',
   ...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
  const result=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(result.error||'Server nicht erreichbar');
  return result;
 }
 async function reload(){
  try{
   const result=await request();
   setRules(result.rules||[]);setEvents(result.events||[]);setState('ready');
   onRulesChange((result.rules||[]).map(x=>({title:x.title,limit:Number(x.target_price),enabled:x.enabled})));
  }catch(e){setState('offline');setNotice('Serverseitiger Preisspeicher: '+e.message);onRulesChange(null)}
 }
 useEffect(()=>{void reload()},[]);
 useEffect(()=>{if(initialTitle)setTitle(initialTitle)},[initialTitle]);
 async function act(method,data,label){
  setBusy(true);setNotice('');
  try{
   const r=await request(method,data);
   await reload();
   setNotice(label||('Geprüft: '+r.checked+' Regeln, '+r.created+' neue Meldungen.'));
  }catch(e){setNotice('Aktion fehlgeschlagen: '+e.message)}
  finally{setBusy(false)}
 }
 function save(){
  const amount=Number(String(limit).trim().replace(',','.'));
  if(!title||!Object.hasOwn(priceGames,title)||!Number.isFinite(amount)||amount<0||amount>10000){
   setNotice('Wähle einen angebotenen Titel und gültigen Euro-Zielpreis.');return;
  }
  void act('POST',{title,limit:amount},'Preisziel sicher im privaten Cloud-Speicher abgelegt.');
 }
 async function migrate(){
  const missing=localRules.filter(x=>x?.title&&Object.hasOwn(priceGames,x.title)&&!rules.some(r=>r.title===x.title));
  if(!missing.length){setNotice('Alle passenden lokalen Regeln sind bereits in der Cloud.');return}
  setBusy(true);setNotice('');
  let imported=0;
  try{
   for(const x of missing){await request('POST',x);imported++}
   await reload();setNotice(imported+' bisher lokale Regeln in den privaten Server-Speicher übernommen.');
  }catch(e){await reload();setNotice('Teilweise übertragen ('+imported+'). '+e.message)}
  finally{setBusy(false)}
 }
 const unseen=events.filter(e=>!e.read_at).length;
 return <div className="rz-cloud-alerts">
  <div className="rz-alert-intro"><div>
   <span className="rz-kicker">PRICE INTELLIGENCE · PRIVATE CLOUD</span><h3>Automatische Preisüberwachung</h3>
   <p>Gespeicherte Preisziele werden serverseitig täglich mit den zuletzt verifizierten Radar-Angeboten verglichen. Treffer erscheinen dauerhaft in deinem Posteingang – auch wenn dein Browser geschlossen ist.</p>
  </div><span className={'rz-alert-state '+(state==='ready'?'is-ready':'')}>{state==='ready'?'Cloud verbunden':state==='loading'?'Verbindung wird geprüft':'Cloud nicht verfügbar'}</span></div>
  <div className="rz-alert-info"><strong>Täglich einmal · Vercel Hobby</strong><span>Es gibt keine Sofortbenachrichtigungen und keinen externen Versand. Preise werden ausschließlich aus geprüften Radar-Daten verwendet.</span></div>
  {state==='offline'?<div className="rz-alert-fallback"><h4>Offline weiterplanen</h4><p>Du kannst Preisregeln weiterhin auf diesem Gerät speichern. Diese werden erst nach ausdrücklicher Übernahme in die Cloud täglich geprüft.</p><div className="rz-rule-editor rz-cloud-editor"><label>Spiel<select value={title} onChange={e=>setTitle(e.target.value)}><option value="">Titel auswählen …</option>{Object.keys(priceGames).sort((a,b)=>a.localeCompare(b,'de')).map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Zielpreis (€)<input inputMode="decimal" value={limit} onChange={e=>setLimit(e.target.value)}/></label><button type="button" onClick={()=>{const amount=Number(String(limit).replace(',','.'));if(title&&Object.hasOwn(priceGames,title)&&Number.isFinite(amount)&&amount>=0&&amount<=10000){onLocalSave([...localRules.filter(r=>r.title!==title),{title,limit:amount,enabled:true}]);setNotice('Nur lokal gespeichert, keine tägliche Überwachung aktiv.')}else setNotice('Bitte gültigen Preis und Titel wählen.')}}>Lokal speichern</button></div>{localRules.length?<p>{localRules.length} nur lokal gespeicherte Preisregel(n).</p>:null}<button className="rz-scan-now" type="button" onClick={()=>{setState('loading');void reload()}}>Cloud-Verbindung erneut prüfen</button></div>:null}
  {state==='ready'?<>
   <div className="rz-rule-editor rz-cloud-editor"><label>Spiel<select value={title} onChange={e=>setTitle(e.target.value)}><option value="">Titel auswählen …</option>{Object.keys(priceGames).sort((a,b)=>a.localeCompare(b,'de')).map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Mein Maximalpreis (€)<input inputMode="decimal" value={limit} onChange={e=>setLimit(e.target.value)} aria-label="Zielpreis in Euro"/></label><button type="button" disabled={busy} onClick={save}>Preisregel speichern</button></div>
   {localRules.filter(x=>!rules.some(r=>r.title===x.title)).length>0?<button className="rz-import-local" type="button" disabled={busy} onClick={()=>void migrate()}>Bisherige lokale Preisregeln in die Cloud übernehmen</button>:null}
   <div className="rz-cloud-rule-list">{rules.length?rules.map(x=><article key={x.title} className="rz-rule"><div><strong>{x.title}</strong><small>Ziel {euro(x.target_price)} · {status[x.last_status]||status.unverified}</small><small>Letzte Prüfung: {date(x.last_checked_at)}</small></div><button type="button" disabled={busy} onClick={()=>void act('DELETE',{title:x.title},'Preisregel entfernt.')}>Entfernen</button></article>):<div className="rz-empty">Noch keine serverseitigen Preisregeln gespeichert.</div>}</div>
   <button className="rz-scan-now" type="button" disabled={busy} onClick={()=>void act('PUT',null,null)}>Jetzt serverseitig prüfen</button>
   <div className="rz-alert-inbox-head"><h3>Deine Preis-Meldungen</h3><span>{unseen} ungelesen</span></div>
   <div className="rz-cloud-inbox">{events.length?events.map(e=><article key={e.id} className={'rz-alert-event'+(!e.read_at?' is-unread':'')}>
     <div><strong>{e.title}</strong><small>{euro(e.observed_price)} statt Ziel {euro(e.target_price)} · Beobachtung {date(e.observed_at)}</small><small>Gemeldet: {date(e.created_at)}</small></div>
     {!e.read_at?<button type="button" disabled={busy} onClick={()=>void act('PATCH',{id:e.id},'Meldung als gelesen markiert.')}>Gelesen</button>:<span>Gelesen</span>}
   </article>):<div className="rz-empty">Noch keine bestätigten Preisziele erreicht. Sobald ein gültiges Angebot innerhalb deines Limits erfasst wird, erscheint es hier.</div>}</div>
  </>:<p className="rz-muted">Deine lokalen Preisregeln bleiben im Browser erhalten. Serverüberwachung setzt den konfigurierten privaten Speicher voraus.</p>}
  {notice?<p className="rz-message" role="status">{notice}</p>:null}
 </div>;
}
