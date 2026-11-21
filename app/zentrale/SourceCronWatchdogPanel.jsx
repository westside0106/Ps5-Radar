'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import styles from './SourceCronWatchdogPanel.module.css';
const descriptions={
 ok:'Cron erfolgreich abgeschlossen',
 failed:'Cron fehlgeschlagen',
 unfinished:'Cron ohne Abschluss',
 missing:'Kein Cron-Lauf protokolliert',
 unconfirmed:'Cron nicht bestätigt · Tagesdaten vorhanden'
};
function stamp(date){
 const t=Date.parse(date||'');
 return Number.isFinite(t)?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(t):'—';
}
export default function SourceCronWatchdogPanel(){
 const [days,setDays]=useState([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const load=useCallback(async(signal)=>{
  const response=await fetch('/zentrale/api/source-watchdog',{credentials:'same-origin',cache:'no-store',signal});
  if(!response.ok)throw Error(response.status===401?'Sitzung abgelaufen.':'Watchdog-Verlauf nicht erreichbar.');
  const result=await response.json();
  if(!Array.isArray(result.days))throw Error('Ungültige Watchdog-Antwort.');
  return result.days;
 },[]);
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  async function refresh(){
   if(document.visibilityState!=='visible'||!active)return;
   try{
    const data=await load(controller.signal);
    if(active){setDays(data);setError('')}
   }catch(e){if(active&&!controller.signal.aborted)setError(e.message||'Watchdog nicht erreichbar')}
   finally{if(active)setLoading(false)}
  }
  void refresh();
  const timer=setInterval(()=>{void refresh()},120000);
  const scanned=()=>{void refresh()};
  const visible=()=>{if(document.visibilityState==='visible')void refresh()};
  window.addEventListener('radar:source-scan-complete',scanned);
  document.addEventListener('visibilitychange',visible);
  return()=>{active=false;clearInterval(timer);controller.abort();
   window.removeEventListener('radar:source-scan-complete',scanned);
   document.removeEventListener('visibilitychange',visible)};
 },[load]);
 const current=useMemo(()=>days[0]||null,[days]);
 const today=new Date().toISOString().slice(0,10);
 const todayEntry=days.find(x=>x.run_day===today);
 const heading=todayEntry?descriptions[todayEntry.status]||'Unbekannter Watchdog-Status'
  :'Heute noch keine Watchdog-Auswertung';
 return <section className={styles.root} aria-label="Automatischer Quellen-Cron-Wächter">
  <div className={styles.head}><div>
   <span className={styles.kicker}>INDEPENDENT DAILY WATCHDOG</span>
   <h3>CRON-WÄCHTER <em>& FEHLERHINWEISE</em></h3>
   <p>Separate Tageskontrolle um 11:15 UTC, nachdem der reguläre 09:00-UTC-Quellencheck sein Zeitfenster hatte. Die Meldungen enthalten keine PSN- oder Kontodaten.</p>
  </div>
  <button type="button" className={styles.refresh} disabled={busy} onClick={async()=>{
   if(busy)return;setBusy(true);
   try{setDays(await load());setError('')}
   catch(e){setError(e.message||'Abfrage fehlgeschlagen')}
   finally{setBusy(false);setLoading(false)}
  }}>{busy?'AKTUALISIERE …':'WÄCHTER AKTUALISIEREN'}</button></div>
  <div className={styles.summary} data-status={todayEntry?.status||'pending'}>
   <strong>{heading}</strong>
   <small>{todayEntry?'Prüfung: '+stamp(todayEntry.checked_at)
    :'Noch kein endgültiges Ergebnis des heutigen unabhängigen Cron-Laufs. Das ist vor dem Prüfzeitfenster normal.'}</small>
  </div>
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {loading?<p className={styles.hint}>Watchdog-Protokoll wird geladen …</p>:null}
  {!loading&&!days.length?<p className={styles.hint}>Noch kein Watchdog-Tagesprotokoll gespeichert. Die Funktion erzeugt keine rückdatierten Ergebnisse.</p>:null}
  {days.length?<div className={styles.records} role="list" aria-label="Letzte Watchdog-Prüftage">
   {days.slice(0,7).map(d=><div role="listitem" key={d.run_day} className={styles.record} data-status={d.status}>
    <strong>{d.run_day}</strong>
    <span>{descriptions[d.status]||'Unbekannt'}</span>
    <small>{d.status==='ok'?'Kein Warn-Push erforderlich'
     :d.push_sent_at?'ntfy nahm Warnung an'
     :d.push_last_error?'ntfy-Zustellung nicht bestätigt'
     :d.push_attempts?'Warnung in Zustellwarteschlange'
     :'Warnung noch nicht bestätigt'} · {d.scheduled_runs} Cron-Läufe</small>
   </div>)}
  </div>:null}
  <p className={styles.foot}>Der Wächter ersetzt keinen unabhängig externen Uptime-Dienst: Wenn beide Vercel-Cron-Auslöser ausfallen, kann auch die Warnung fehlen. „Nicht protokolliert“ bedeutet nicht zwingend, dass der Job nie ausgeführt wurde. ntfy bestätigt nur die Annahme, nicht den Empfang auf dem iPhone.</p>
 </section>;
}
