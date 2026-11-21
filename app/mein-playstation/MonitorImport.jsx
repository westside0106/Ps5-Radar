'use client';
import {useEffect,useMemo,useState} from 'react';
import {PSN_MONITOR_KEY,PSN_MONITOR_EVENT,MAX_MONITOR_CSV_BYTES,MAX_MONITOR_SESSIONS,parsePsnMonitorCsv,normalizeObservedSessions,mergeObservedSessions} from '../../lib/psn-monitor-import.mjs';
import styles from './MonitorImport.module.css';

const zones=[
 ['','Zeitzone des Monitor-Rechners auswählen …'],
 ['UTC','UTC – häufig auf Ubuntu-Servern'],
 ['Europe/Berlin','Europe/Berlin – deutsche Winter-/Sommerzeit'],
 ['Europe/London','Europe/London'],
 ['America/New_York','America/New_York'],
 ['America/Los_Angeles','America/Los_Angeles'],
 ['Asia/Tokyo','Asia/Tokyo']
];
const durations=minutes=>minutes>=60?(minutes/60).toLocaleString('de-DE',{maximumFractionDigits:1})+' h':Math.round(minutes)+' min';
const stamp=(date,zone)=>{
 try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:zone}).format(new Date(date))}
 catch{return date}
};
const warningLabels={
 malformed:'Ungültige CSV-Zeilen oder Zeitangaben',ambiguous:'Doppelte Uhrzeit bei Zeitumstellung',nonexistent:'Nicht vorhandene Uhrzeit bei Zeitumstellung',
 outOfOrder:'Rückwärts laufende Zeitstempel',unknownStatus:'Unbekannte PSN-Statuswerte',duplicates:'Doppelte Statusmeldungen',
 longGaps:'Intervalle über 12 Stunden (nicht gewertet)',incomplete:'Unvollständige letzte Sitzung (nicht gewertet)',future:'Zeitstempel in der Zukunft'
};
function overview(sessions){
 const totalMinutes=sessions.reduce((n,s)=>n+s.minutes,0);
 const byGame=new Map();
 for(const s of sessions){
  const key=s.game.toLocaleLowerCase('de'),p=byGame.get(key)||{title:s.game,count:0,minutes:0};
  p.count++;p.minutes+=s.minutes;byGame.set(key,p);
 }
 return {totalMinutes,gameCount:byGame.size,byGame:[...byGame.values()].sort((a,b)=>b.minutes-a.minutes||a.title.localeCompare(b.title,'de')).slice(0,7),
  last:sessions.slice(-12).reverse()};
}
export default function MonitorImport(){
 const [timeZone,setTimeZone]=useState('');
 const [preview,setPreview]=useState(null);
 const [saved,setSaved]=useState([]);
 const [fileName,setFileName]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [showAll,setShowAll]=useState(false);
 useEffect(()=>{
  const refresh=()=>{try{setSaved(normalizeObservedSessions(JSON.parse(localStorage.getItem(PSN_MONITOR_KEY)||'[]')))}catch{setSaved([])}};
  refresh();
  window.addEventListener(PSN_MONITOR_EVENT,refresh);
  window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener(PSN_MONITOR_EVENT,refresh);window.removeEventListener('storage',refresh)};
 },[]);
 const current=useMemo(()=>overview(saved),[saved]);
 async function selectFile(event){
  const file=event.target.files?.[0];event.target.value='';
  setPreview(null);setMessage('');
  if(!file)return;
  if(!timeZone){setMessage('Zuerst die Zeitzone des Computers wählen, auf dem psn_monitor lief.');return}
  if(file.size>MAX_MONITOR_CSV_BYTES){setMessage('Datei ist zu groß (maximal 2 MB). Bitte CSV in kleinere Dateien aufteilen.');return}
  setBusy(true);
  try{
   const content=await file.text();
   const data=parsePsnMonitorCsv(content,{timeZone});
   setPreview(data);setFileName(file.name);
   setMessage(data.sessions.length?'Vorschau berechnet. Prüfe die erkannten Intervalle vor dem Speichern.':'Keine belastbar abgeschlossenen Spielintervalle in diesem CSV gefunden.');
  }catch(error){setMessage(String(error?.message||'CSV konnte nicht gelesen werden.'))}
  finally{setBusy(false)}
 }
 function persist(next,success){
  try{
   localStorage.setItem(PSN_MONITOR_KEY,JSON.stringify(next));
   setSaved(next);setPreview(null);setMessage(success);
   window.dispatchEvent(new Event(PSN_MONITOR_EVENT));
   window.dispatchEvent(new Event('psn-profile-local-change'));
  }catch{setMessage('Speichern fehlgeschlagen: Browser-Speicher prüfen. Es wurden keine bestehenden Daten verändert.')}
 }
 function commit(){
  if(!preview?.sessions?.length)return;
  const before=normalizeObservedSessions(saved),after=mergeObservedSessions(before,preview.sessions);
  const added=after.length-before.filter(x=>after.some(y=>y.id===x.id)).length;
  persist(after,Math.max(0,added)+' neue beobachtete Intervalle importiert. '+after.length+' insgesamt gespeichert (max. '+MAX_MONITOR_SESSIONS+').');
 }
 function remove(){
  if(!saved.length||!window.confirm('Alle lokal gespeicherten psn_monitor-Intervalle löschen? Ein zuvor exportiertes JSON-Backup bleibt erhalten.'))return;
  persist([],'Alle lokal erfassten Monitor-Intervalle gelöscht.');
 }
 const warnings=preview?Object.entries(preview.warningCounts).filter(([,n])=>n>0):[];
 return <section id="psn-monitor-import" className={styles.root} aria-label="PSN Monitor Sitzungsanalyse">
  <div className={styles.decor} aria-hidden="true"/>
  <header className={styles.header}>
   <div><span className={styles.kicker}><span className={styles.signal}/> SESSION INTELLIGENCE // OBSERVED</span>
    <h4>DEINE SPIELZEIT.<em> BEOBACHTET.</em></h4>
    <p>Zusätzliche Spielzeit-Analyse aus dem CSV-Protokoll von <a href="https://github.com/misiektoja/psn_monitor" target="_blank" rel="noopener noreferrer">psn_monitor</a>. Nur Start-/Wechsel-/Endmeldungen, die wirklich im Protokoll stehen, bilden auswertbare Intervalle.</p>
   </div>
   <div className={styles.emblem} aria-hidden="true"><span>⏱</span></div>
  </header>
  <div className={styles.metrics}>
   <div><small>BEOBACHTETE INTERVALLE</small><strong>{saved.length.toLocaleString('de-DE')}</strong><span>Keine simulierten Spielsessions</span></div>
   <div><small>BEOBACHTETE ZEIT</small><strong>{saved.length?durations(current.totalMinutes):'—'}</strong><span>Aus Statuswechseln, nicht Sony-Gesamtzeit</span></div>
   <div><small>ERKANNTE SPIELE</small><strong>{current.gameCount.toLocaleString('de-DE')}</strong><span>Keine unsichere PSN-Titelzuordnung</span></div>
  </div>
  <div className={styles.layout}>
   <div className={styles.importer}>
    <div className={styles.boxTitle}><span>01 / IMPORT-CONSOLE</span><small>CSV → lokal → überprüft</small></div>
    <label className={styles.field}>Zeitzone des Rechners, der die CSV geschrieben hat
     <select value={timeZone} onChange={e=>{setTimeZone(e.target.value);setPreview(null);setMessage('')}}>
      {zones.map(([key,label])=><option key={key} value={key}>{label}</option>)}
     </select>
    </label>
    <label className={styles.field}>CSV-Datei aus psn_monitor auswählen
     <input type="file" accept=".csv,text/csv" disabled={!timeZone||busy} onChange={e=>void selectFile(e)}/>
    </label>
    <p className={styles.hint}>Erwartete Spalten: <code>Date, Status, Game name</code>. Die Datei wird nur im Browser verarbeitet. Kein erneuter PSN-Login, keine Hintergrundüberwachung.</p>
    {preview?<div className={styles.preview}>
     <strong>IMPORT-VORSCHAU · {fileName}</strong>
     <div><span>{preview.rows.toLocaleString('de-DE')} CSV-Zeilen</span><span>{preview.sessions.length.toLocaleString('de-DE')} abgeschlossene Intervalle</span><span>{durations(preview.totalMinutes)} beobachtet</span></div>
     {warnings.length?<div className={styles.warnings}><small>NICHT GEWERTETE / AUFFÄLLIGE EINTRÄGE</small>{warnings.map(([key,n])=><p key={key}>{warningLabels[key]}: <strong>{n}</strong></p>)}</div>:<p className={styles.clean}>Keine Datenanomalien in der Vorschau erkannt.</p>}
     <div className={styles.actions}><button type="button" className={styles.primary} disabled={!preview.sessions.length} onClick={commit}>PRÜFUNG BESTÄTIGEN &amp; IMPORTIEREN ↗</button><button type="button" onClick={()=>{setPreview(null);setMessage('Vorschau verworfen.')}}>Verwerfen</button></div>
    </div>:null}
    {message?<p className={styles.message} role="status">{message}</p>:null}
    {saved.length?<button type="button" className={styles.delete} onClick={remove}>Gespeicherte Monitor-Intervalle löschen</button>:null}
    <p className={styles.hint}>Wichtig: psn_monitor erfasst Übergänge durch wiederholte Abfragen. Monitor-Ausfall, Ruhezustand, Verzögerungen und längere Zeitlücken verfälschen die Genauigkeit. Intervalle über 12 Stunden und solche ohne Abschlussmeldung werden ausgeschlossen. Zeitstempel bei unklarer Sommerzeit-Umstellung ebenfalls.</p>
   </div>
   <div className={styles.results}>
    <div className={styles.boxTitle}><span>02 / PLAYTIME INTELLIGENCE</span><small>Nur lokal gespeicherte Daten</small></div>
    {current.byGame.length?<div className={styles.ranking}>
     {current.byGame.map((g,i)=><div key={g.title} className={styles.rank}>
      <span className={styles.rankNum}>{String(i+1).padStart(2,'0')}</span>
      <div><strong>{g.title}</strong><small>{g.count} Intervalle</small><div className={styles.bar}><span style={{width:Math.min(100,(g.minutes/current.byGame[0].minutes)*100)+'%'}}/></div></div>
      <strong>{durations(g.minutes)}</strong>
     </div>)}
    </div>:<p className={styles.placeholder}>Noch keine CSV importiert. Wähle links die Zeitzone deines Monitor-Rechners und lade dessen Statusprotokoll. Nach der Vorschau erscheinen hier die nachgewiesenen Zeitintervalle.</p>}
   </div>
  </div>
  {current.last.length?<div className={styles.history}>
   <div className={styles.boxTitle}><span>03 / RECENT OBSERVED SESSIONS</span><small>Start bis beobachteter Wechsel/Stop</small></div>
   <div className={styles.timeline}>{(showAll?current.last:current.last.slice(0,5)).map(x=><article key={x.id}>
    <div><strong>{x.game}</strong><small>{stamp(x.start,x.timeZone)} → {stamp(x.end,x.timeZone)} · {x.timeZone}</small></div>
    <div><strong>{durations(x.minutes)}</strong><small>{x.stopReason==='offline'?'Offline-Meldung':x.stopReason==='game-switch'?'Spielwechsel':x.stopReason==='game-stopped'?'Spiel beendet':'Statuswechsel'}</small></div>
   </article>)}</div>
   {current.last.length>5?<button type="button" className={styles.showMore} onClick={()=>setShowAll(x=>!x)}>{showAll?'Weniger anzeigen':'Weitere Intervalle anzeigen'}</button>:null}
  </div>:null}
  <footer className={styles.footer}><span>SOURCE · MISIEKTOJA / PSN_MONITOR · CSV IMPORT</span><p>Importierte Daten sind persönliche Aktivitätsdaten. Sie werden lokal gespeichert und sind über das vollständige JSON-Backup exportierbar. Falls die optionale PS5-Radar-Cloud-Sicherung aktiviert ist, können sie darüber ebenfalls gesichert werden.</p></footer>
 </section>;
}
