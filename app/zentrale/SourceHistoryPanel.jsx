'use client';
import {useEffect,useMemo,useState} from 'react';
import styles from './SourceHistoryPanel.module.css';

const names={psn:'PlayStation Network',igdb:'IGDB / Twitch',rawg:'RAWG',steamgriddb:'SteamGridDB',profile:'Supabase · Spielwelt',monitor:'Supabase · PSN-Monitor'};
const stateLabel={healthy:'Erreichbar',degraded:'Eingeschränkt',error:'Fehler',unconfigured:'Nicht eingerichtet'};
const fmt=value=>{
 const ms=Date.parse(value||'');
 return Number.isFinite(ms)?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(ms):'Unbekannt';
};
export default function SourceHistoryPanel(){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  const load=async()=>{
   try{
    const res=await fetch('/zentrale/api/source-history',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(!res.ok)throw Error(res.status===401?'Sitzung abgelaufen.':'Gespeicherte Prüfdaten nicht erreichbar.');
    const json=await res.json();
    if(!Array.isArray(json.checks)||!Array.isArray(json.events))throw Error('Ungültige Historienantwort.');
    if(!controller.signal.aborted)setData(json);
   }catch(e){if(!controller.signal.aborted)setError(e.message||'Fehler beim Laden.')}
   finally{if(!controller.signal.aborted)setLoading(false)}
  };
  void load();return()=>controller.abort();
 },[]);
 useEffect(()=>{
  let active=true;
  async function refreshHistory(){
   try{
    const response=await fetch('/zentrale/api/source-history',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw Error('Historie nicht aktualisiert');
    const result=await response.json();
    if(active&&Array.isArray(result.checks)&&Array.isArray(result.events)){
     setData(result);setError('');
    }
   }catch{if(active)setNotice('Sofortprüfung abgeschlossen, aber die neue Historie konnte nicht geladen werden.')}
  }
  const onSourceScan=()=>{void refreshHistory()};
  window.addEventListener('radar:source-scan-complete',onSourceScan);
  return()=>{active=false;window.removeEventListener('radar:source-scan-complete',onSourceScan)};
 },[]);
 const [day0]=useState(()=>new Date().toISOString().slice(0,10));
 const days=useMemo(()=>Array.from({length:14},(_,i)=>new Date(Date.parse(day0+'T00:00:00Z')-(13-i)*86400000).toISOString().slice(0,10)),[day0]);
 const dataMap=useMemo(()=>new Map((data?.checks||[]).map(x=>[x.source_id+':'+x.run_day,x])),[data]);
 const events=data?.events||[];
 const unread=events.filter(e=>!e.read_at).length;
 async function markRead(id){
  setBusy(id);setNotice('');
  try{
   const res=await fetch('/zentrale/api/source-history',{method:'PATCH',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
   const json=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(json.error||'Nicht gespeichert');
   setData(old=>({...old,events:old.events.map(e=>e.id===id?{...e,read_at:new Date().toISOString()}:e)}));
  }catch(e){setNotice(e.message||'Markieren fehlgeschlagen')}
  finally{setBusy('')}
 }
 return <section className={styles.root} aria-label="Datenquellen-Historie und Meldungen">
  <header className={styles.head}><div><span className={styles.kicker}>DAILY SIGNAL ARCHIVE / PRIVATE INBOX</span>
   <h2>STATUS-<em>HISTORIE</em></h2>
   <p>Automatisch gespeicherte Tagesprüfungen und Meldungen nach wiederholten Fehlern. Fehlende Tage sind unbekannt, nicht erfolgreich.</p></div>
   <span className={styles.cadence}>1× täglich · UTC</span>
  </header>
  {loading?<p className={styles.subtle} role="status">Historie wird geladen …</p>:null}
  {error?<p className={styles.error} role="alert">{error} Die Live-Diagnose oben ist davon unabhängig.</p>:null}
  {data?<><div className={styles.summary}><strong>{data.checks.length}</strong><span>Gespeicherte Tages-Messungen (max. 600 geladen)</span><strong>{unread}</strong><span>Ungelesene Ereignisse</span></div>
   <div className={styles.timeline}>
    {Object.entries(names).map(([id,name])=>{
     const stat=(data.summary||[]).find(x=>x.source_id===id);
     return <article className={styles.source} key={id}>
      <div className={styles.sourceTop}><h3>{name}</h3><span>{stat?.total?stat.healthy+' / '+stat.total+' erfolgreiche Prüfungen (letzte 30 Kalendertage)':'Keine Tagesprüfungen'}</span></div>
      <div className={styles.days} role="list" aria-label={'14 tägliche Prüfergebnisse für '+name}>
       {days.map(day=>{const x=dataMap.get(id+':'+day);return <span role="listitem" key={day} title={day+' · '+(x?stateLabel[x.status]||'Unbekannt':'Nicht geprüft')+(x?' · '+x.detail:'')} className={styles.day} data-state={x?.status||'missing'} aria-label={day+': '+(x?stateLabel[x.status]||'Unbekannt':'Keine Prüfung')}/>})}
      </div>
      <small>Letzter gespeicherter Test: {stat?.last?fmt(stat.last.checked_at)+' · '+(stateLabel[stat.last.status]||'Unbekannt'):'—'}</small>
     </article>})}
   </div>
   <div className={styles.legend}><span><i data-state="healthy"/> Erreichbar</span><span><i data-state="degraded"/> Eingeschränkt</span><span><i data-state="error"/> Fehler</span><span><i data-state="unconfigured"/> Nicht eingerichtet</span><span><i data-state="missing"/> Nicht geprüft</span></div>
   <div className={styles.inboxHead}><h3>MELDUNGSZENTRALE</h3><span>{unread} ungelesen</span></div>
   <div className={styles.inbox}>{events.length?events.slice(0,30).map(e=><article key={e.id} className={styles.event} data-event={e.event} data-read={Boolean(e.read_at)}>
    <div><strong>{e.event==='outage'?'Wiederholte Störung':'Verbindung wiederhergestellt'} · {names[e.source_id]||e.source_id}</strong>
     <p>{e.detail}</p><small>{fmt(e.created_at)} · {e.read_at?'Gelesen':'Ungelesen'}</small><small>{e.push_sent_at?'ntfy-Versand: '+fmt(e.push_sent_at):e.push_last_error?'ntfy: ausstehend, letzter Versuch '+e.push_last_error:'ntfy: noch kein bestätigter Versand'}</small></div>
    {!e.read_at?<button type="button" disabled={Boolean(busy)} onClick={()=>void markRead(e.id)}>Als gelesen markieren</button>:null}
   </article>):<p className={styles.subtle}>Noch keine bestätigten Störungs- oder Wiederherstellungsereignisse. Bei zwei aufeinanderfolgenden problematischen Tagesprüfungen erscheint automatisch eine Meldung.</p>}</div>
  </>:null}
  {notice?<p className={styles.error} role="status">{notice}</p>:null}
  <p className={styles.foot}>Automatische Erkennung bedeutet hier eine Tagesprüfung, keine Echtzeit-Alarmierung. Meldungen erscheinen immer im privaten Posteingang und bei eingerichteter ntfy-Zustellung zusätzlich als iOS-Push. E-Mails werden nicht versendet. Zwei aufeinanderfolgende UTC-Kalendertage mit „Fehler“ oder „Eingeschränkt“ lösen eine Störungsmeldung aus; ein isolierter Fehler nicht.</p>
 </section>;
}
