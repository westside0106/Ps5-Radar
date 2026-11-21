'use client';
import {useCallback,useEffect,useState} from 'react';
import styles from './SourceHealthMonitor.module.css';

const labels={
 healthy:'Erreichbar',
 degraded:'Eingeschränkt',
 error:'Fehler',
 unconfigured:'Nicht eingerichtet'
};
const localTime=value=>{
 const ms=Date.parse(value||'');
 return Number.isFinite(ms)?new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'}).format(ms):'unbekannt';
};
export default function SourceHealthMonitor(){
 const [snapshot,setSnapshot]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async signal=>{
  setLoading(true);setError('');
  try{
   const response=await fetch('/zentrale/api/source-health',{credentials:'same-origin',cache:'no-store',signal});
   if(!response.ok)throw new Error(response.status===401?'Sitzung abgelaufen. Bitte erneut anmelden.':'Diagnose konnte nicht geladen werden.');
   const data=await response.json();
   if(!Array.isArray(data.checks))throw new Error('Ungültige Diagnoseantwort.');
   if(!signal?.aborted)setSnapshot(data);
  }catch(e){
   if(!signal?.aborted)setError(e.message||'Netzwerkfehler');
  }finally{if(!signal?.aborted)setLoading(false)}
 },[]);
 useEffect(()=>{
  let controller=null;
  let lastStarted=0;
  const REFRESH_MS=3*60*1000;
  function refresh(){
   if(document.visibilityState!=='visible')return;
   controller?.abort();
   controller=new AbortController();
   lastStarted=Date.now();
   void load(controller.signal);
  }
  function onVisibility(){
   if(document.visibilityState==='visible'){
    if(Date.now()-lastStarted>=REFRESH_MS)refresh();
   }else{
    controller?.abort();
    setLoading(false);
   }
  }
  function onManualScan(event){
   const report=event.detail;
   if(!Array.isArray(report?.checks)||!report.summary)return;
   controller?.abort();
   lastStarted=Date.now();
   setSnapshot({checkedAt:report.checkedAt,checks:report.checks,summary:report.summary,cacheSeconds:0});
   setLoading(false);setError('');
  }
  refresh();
  const timer=setInterval(()=>{if(Date.now()-lastStarted>=REFRESH_MS)refresh()},30000);
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('radar:source-scan-complete',onManualScan);
  return()=>{
   clearInterval(timer);controller?.abort();
   document.removeEventListener('visibilitychange',onVisibility);
   window.removeEventListener('radar:source-scan-complete',onManualScan);
  };
 },[load]);
 const summary=snapshot?.summary;
 return <section className={styles.root} aria-label="Datenquellen-Monitor">
  <div className={styles.head}>
   <div><span className={styles.kicker}>SIGNAL INTELLIGENCE / LIVE DIAGNOSTICS</span>
    <h2>DATENQUELLEN-<span>MONITOR</span></h2>
    <p>Geschützte, echte Abfragen deiner integrierten Anbieter. Konfiguration, Erreichbarkeit und Aktualität sind unterschiedliche Prüfgrößen.</p>
   </div>
   <button type="button" className={styles.refresh} disabled={loading} onClick={()=>load()}>{loading?'PRÜFUNG LÄUFT …':'ERNEUT PRÜFEN'}</button>
  </div>
  {summary?<div className={styles.metrics} aria-label="Anbieterstatus">
   <div><strong>{summary.healthy}</strong><span>ERREICHBAR</span></div>
   <div><strong>{summary.degraded}</strong><span>EINGESCHRÄNKT</span></div>
   <div><strong>{summary.error}</strong><span>FEHLER</span></div>
   <div><strong>{summary.unconfigured}</strong><span>NICHT EINGERICHTET</span></div>
  </div>:null}
  {error?<p className={styles.error} role="alert">{error}{snapshot?' · Letzter Prüfstand bleibt zur Orientierung sichtbar.':''}</p>:null}
  {loading&&!snapshot?<p className={styles.loading} role="status">PSN, IGDB, RAWG, SteamGridDB und beide Cloud-Speicher werden geprüft …</p>:null}
  {snapshot?<><div className={styles.timestamp} role="status"><span>LETZTER PRÜFLAUF: {localTime(snapshot.checkedAt)}</span><span>Im geöffneten Tab automatische Aktualisierung ca. alle 3 Minuten · Server-Cache bis {snapshot.cacheSeconds} Sekunden</span></div>
   <div className={styles.grid}>
    {snapshot.checks.map(item=><article key={item.id} className={styles.provider} data-state={item.state}>
     <header><span className={styles.id}>{item.id.toUpperCase()}</span><span className={styles.state}>{labels[item.state]||'Unbekannt'}</span></header>
     <h3>{item.name}</h3>
     <p>{item.detail}</p>
     {item.nextStep?<div className={styles.guidance}><strong>NÄCHSTER SCHRITT</strong><span>{item.nextStep}</span></div>:null}
     {item.lastDataAt?<small>DATENZEIT: {localTime(item.lastDataAt)}{Number.isFinite(item.ageMinutes)?' · '+item.ageMinutes+' min alt':''}</small>:<small>KEIN BESTÄTIGTER DATENZEITPUNKT</small>}
    </article>)}
   </div>
  </>:null}
  <p className={styles.note}>Diese Live-Ansicht aktualisiert sich bei geöffnetem, sichtbarem Tab etwa alle drei Minuten und pausiert im Hintergrund. Die gespeicherte Tageshistorie bleibt eine getrennte, einmal tägliche Messreihe – kein kontinuierliches SLA-Monitoring. „Erreichbar“ bestätigt nur die jeweilige Testabfrage, nicht die Vollständigkeit aller Spiele, Bilder oder Trophäen. Zugangsdaten und private Spielinhalte werden nicht ausgegeben.</p>
 </section>;
}
