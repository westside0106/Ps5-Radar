'use client';
import {useState} from 'react';
import styles from './SourceLiveOpsPanel.module.css';

const stamp=value=>{
 const t=Date.parse(value||'');
 return Number.isFinite(t)?new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'}).format(t):'—';
};
export default function SourceLiveOpsPanel(){
 const [running,setRunning]=useState(false),[result,setResult]=useState(null);
 const [error,setError]=useState(''),[lastAttempt,setLastAttempt]=useState(null);
 async function run(){
  if(running)return;
  setRunning(true);setError('');
  try{
   const response=await fetch('/zentrale/api/source-live-run',{
    method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'}
   });
   const report=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(report.error||'Sofortprüfung nicht verfügbar');
   if(!report.ok||!Array.isArray(report.checks)||!report.summary)throw Error('Ungültige Prüfantwort');
   setResult(report);
   window.dispatchEvent(new CustomEvent('radar:source-scan-complete',{detail:report}));
  }catch(e){setError(e?.message||'Sofortprüfung fehlgeschlagen')}
  finally{setRunning(false);setLastAttempt(new Date().toISOString())}
 }
 return <section className={styles.root} aria-label="Quellen-Sofortprüfung">
  <div className={styles.header}>
   <div><span className={styles.kicker}>LIVE OPERATIONS / MANUAL SCAN</span>
    <h2>QUELLEN <em>JETZT PRÜFEN</em></h2>
    <p>Ein echter, sofortiger Anbietertest. Der erste Lauf des UTC-Tages wird dauerhaft gespeichert und prüft anschließend die Zustellwarteschlange für ntfy.</p>
   </div>
   <button type="button" className={styles.action} disabled={running} onClick={()=>void run()}>{running?'LIVE-CHECK LÄUFT …':'JETZT PRÜFEN & MELDUNGEN SENDEN'}</button>
  </div>
  {running?<p className={styles.progress} role="status">PSN, Metadaten-APIs und Cloud-Speicher werden geprüft. Der Vorgang darf mehrere Sekunden dauern …</p>:null}
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {result?<div className={styles.result} role="status">
   <strong>Letzter Sofortlauf: {stamp(result.checkedAt)}</strong>
   <div className={styles.metrics}>
    <span><b>{result.summary.healthy}</b> erreichbar</span>
    <span><b>{result.summary.degraded}</b> eingeschränkt</span>
    <span><b>{result.summary.error}</b> Fehler</span>
    <span><b>{result.stored?.inserted??0}</b> neue Tageswerte</span>
    <span><b>{result.push?.accepted??0}</b> automatische ntfy-Meldungen</span>
   </div>
   {result.push?.deliveryError||result.push?.failed?<small>Warnung: Mindestens eine Push-Übergabe konnte nicht bestätigt werden. Die Meldung bleibt für einen späteren Versuch erhalten.</small>:null}
   {result.push?.configured===false?<small>ntfy ist nicht eingerichtet; die Quellenprüfung wurde trotzdem gespeichert.</small>:null}
  </div>:null}
  {!result&&lastAttempt&&!error?<p className={styles.progress}>Letzter Versuch: {stamp(lastAttempt)}</p>:null}
  <p className={styles.note}>Ein erfolgreicher Test-Push wird nicht als automatische Störungsmeldung gezählt. Missbrauchsschutz: maximal eine gespeicherte Sofortprüfung alle 10 Minuten. Nur der erste gespeicherte Tagesbefund zählt für die Tageshistorie und automatische Störungsmeldungen. Der tägliche Hintergrundjob bleibt separat aktiv; wiederholte Sofortläufe erzeugen keine doppelten Tagesalarme.</p>
 </section>;
}
