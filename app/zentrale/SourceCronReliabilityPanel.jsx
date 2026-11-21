'use client';
import {useMemo,useState} from 'react';
import {sourceCronTimeline,sourceCronLabel,watchdogVerdictLabel} from '../../lib/source-cron-reliability.mjs';
import styles from './SourceCronReliabilityPanel.module.css';

const formatTime=value=>{
 const time=Date.parse(value||'');
 return Number.isFinite(time)?new Intl.DateTimeFormat('de-DE',{
  timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'
 }).format(time):'—';
};
export default function SourceCronReliabilityPanel({scheduledRuns=[],watchdogDays=[],nowMs=Date.now()}){
 const [windowDays,setWindowDays]=useState(7);
 const timeline=useMemo(()=>sourceCronTimeline(scheduledRuns,watchdogDays,{
  days:windowDays,now:new Date(nowMs)
 }),[scheduledRuns,watchdogDays,nowMs,windowDays]);
 const summary=timeline.summary;
 return <section className={styles.root} aria-label="Cron-Zuverlässigkeit und Tagesnachweise">
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>SCHEDULED JOB EVIDENCE / UTC</span>
    <h4>CRON <em>BETRIEBSVERLAUF</em></h4>
    <p>Automatische Quellenprüfungen und unabhängige Tagesurteile im Vergleich. Fehlende Einträge werden nicht als erfolgreiche oder nachweislich ausgefallene Prüfungen ausgegeben.</p>
   </div>
   <div className={styles.period} role="group" aria-label="Cron-Auswertungszeitraum">
    {[7,30].map(n=><button type="button" key={n}
     aria-pressed={windowDays===n} className={windowDays===n?styles.active:''}
     onClick={()=>setWindowDays(n)}>{n} TAGE</button>)}
   </div>
  </div>
  <div className={styles.metrics}>
   <div><strong>{summary.withCronReceipt}/{windowDays}</strong><span>Tage mit Cron-Nachweis</span></div>
   <div><strong>{summary.successful}</strong><span>Erfolgreich abgeschlossen</span></div>
   <div><strong>{summary.failedOrUnfinished}</strong><span>Fehler / ohne Abschluss</span></div>
   <div><strong>{summary.withWatchdogReceipt}/{windowDays}</strong><span>Watchdog-Tagesurteile</span></div>
  </div>
  {summary.outsideCronWindow>0?<p className={styles.caution} role="status">{summary.outsideCronWindow} protokollierte Cron-Starts lagen außerhalb des vorgesehenen 09:00–10:00-UTC-Fensters. Das allein ist kein Ausfallnachweis.</p>:null}
  <div className={styles.tableScroll}>
   <table aria-label="Cron-Tagesnachweise">
    <thead><tr><th scope="col">UTC-Tag</th><th scope="col">Quellen-Cron</th>
     <th scope="col">Start (MEZ/MESZ)</th><th scope="col">Startfenster</th>
     <th scope="col">Wächter</th><th scope="col">Warnmeldung</th></tr></thead>
    <tbody>{timeline.rows.map(d=><tr key={d.day} data-status={d.status}>
     <th scope="row">{d.day}</th>
     <td><span className={styles.status} data-status={d.status}>{sourceCronLabel[d.status]||'Unbekannt'}</span>
      {d.starts>1?<small>{d.starts} Cron-Versuche</small>:null}</td>
     <td>{d.first?formatTime(d.first.started_at):'—'}</td>
     <td>{d.timing==='within_window'?'09–10 UTC ✓':
      d.timing==='outside_window'?'Außerhalb':'—'}</td>
     <td>{d.watchdog?watchdogVerdictLabel[d.watchdog.status]||'Unbekannt':'Kein Tagesurteil'}</td>
     <td>{!d.watchdog?'—':d.watchdog.status==='ok'?'Keine nötig':
      d.watchdog.pushAccepted?'Von ntfy angenommen':
      d.watchdog.pushError?'Übergabe fehlgeschlagen':
      d.watchdog.pushAttempted?'Zustellversuch offen':'Nicht bestätigt'}</td>
    </tr>)}</tbody>
   </table>
  </div>
  <p className={styles.note}>Die Werte sind <strong>Ausführungsnachweise</strong>, keine Verfügbarkeitsquote. Die Historie wurde erst am 21.11.2026 aktiviert; ältere Tage ohne Protokoll bleiben unbekannt. Auf Vercel Hobby darf ein Cron innerhalb der geplanten Stunde starten – 09:57 UTC zählt deshalb als innerhalb des Zeitfensters. Wird kein Nachweis gefunden, bedeutet das nicht automatisch, dass Vercel den Cron nie ausgeführt hat.</p>
 </section>;
}
