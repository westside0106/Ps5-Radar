'use client';
import {useMemo,useState} from 'react';
import {SOURCE_IDS,SOURCE_NAMES,sourceQualityReport,sourceQualityCsv,qualityStatusLabel} from '../../lib/source-quality.mjs';
import styles from './SourceQualityPanel.module.css';

const formatStamp=value=>{
 const ms=Date.parse(value||'');
 return Number.isFinite(ms)
  ?new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(ms)
  :'—';
};
export default function SourceQualityPanel({checks=[],transitions=[]}){
 const [days,setDays]=useState(7);
 const [sourceId,setSourceId]=useState('all');
 const [anchorDay]=useState(()=>new Date().toISOString().slice(0,10));
 const [note,setNote]=useState('');
 const report=useMemo(()=>sourceQualityReport(checks,transitions,{windowDays:days,anchorDay}),
  [checks,transitions,days,anchorDay]);
 const selected=sourceId==='all'?report.sources:report.sources.filter(x=>x.id===sourceId);
 const exportCsv=()=>{
  try{
   const contents='\ufeff'+sourceQualityCsv(checks,transitions,{windowDays:days,anchorDay,sourceId});
   const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');
   link.href=url;link.download='ps5-radar-quellen-'+days+'tage-'+anchorDay+'.csv';
   link.style.display='none';document.body.appendChild(link);
   link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
   setNote('CSV mit Tagesbefunden und Statuswechseln erstellt. Diagnosetexte und Zugangsdaten sind nicht enthalten.');
  }catch{setNote('CSV-Export konnte nicht erstellt werden.')}
 };
 return <section className={styles.root} aria-label="Datenqualität und Messabdeckung">
  <div className={styles.head}>
   <div><span className={styles.kicker}>SAMPLE COVERAGE / DATA QUALITY</span>
    <h3>MESSABDECKUNG <em>STATT SCHEIN-SLA</em></h3>
    <p>Diese Auswertung berücksichtigt ausschließlich gespeicherte Tagesbefunde. Fehlende Tage sind unbekannt und werden weder als Ausfall noch als Erfolg gewertet.</p>
   </div>
   <div className={styles.controls}>
    <div className={styles.period} role="group" aria-label="Auswertungszeitraum">
     {[7,30].map(n=><button key={n} type="button" aria-pressed={days===n}
      className={days===n?styles.active:''} onClick={()=>{setDays(n);setNote('')}}>{n} TAGE</button>)}
    </div>
    <label className={styles.pick}>QUELLE
     <select value={sourceId} onChange={e=>{setSourceId(e.target.value);setNote('')}} aria-label="Quelle für Datenqualität">
      <option value="all">Alle sechs Quellen</option>
      {SOURCE_IDS.map(id=><option key={id} value={id}>{SOURCE_NAMES[id]}</option>)}
     </select>
    </label>
    <button className={styles.export} type="button" onClick={exportCsv}>CSV EXPORTIEREN</button>
   </div>
  </div>
  <div className={styles.totals}>
   <div><strong>{selected.reduce((sum,x)=>sum+x.measured,0)} / {selected.length*days}</strong><span>Tageswerte vorhanden</span></div>
   <div><strong>{selected.reduce((sum,x)=>sum+x.unmeasured,0)}</strong><span>Tage ohne Befund</span></div>
   <div><strong>{selected.reduce((sum,x)=>sum+x.transitions,0)}</strong><span>Gespeicherte Wechsel</span></div>
  </div>
  <div className={styles.tableScroll}>
   <table aria-label="Messabdeckung der Datenquellen">
    <thead><tr><th scope="col">Datenquelle</th><th scope="col">Gemessen</th><th scope="col">Ohne Daten</th>
     <th scope="col">Erste Befunde gesund</th><th scope="col">Letzte Befunde gesund</th><th scope="col">Zuletzt gespeichert</th></tr></thead>
    <tbody>{selected.map(s=><tr key={s.id}>
     <th scope="row">{s.name}</th>
     <td><strong>{s.measured}/{days}</strong></td>
     <td>{s.unmeasured}</td>
     <td>{s.first.healthy}/{s.measured||0}</td>
     <td>{s.latest.healthy}/{s.measured||0}</td>
     <td>{s.last?<span>{qualityStatusLabel(s.last.latest_status||s.last.status)} · {formatStamp(s.last.latest_checked_at||s.last.checked_at)}</span>:'—'}</td>
    </tr>)}</tbody>
   </table>
  </div>
  {note?<p className={styles.note} role="status">{note}</p>:null}
  <p className={styles.caveat}>Die Quoten beziehen sich nur auf die erfassten Tages-Stichproben – nicht auf 24-Stunden-Verfügbarkeit oder eine vertragliche SLA. Ein Wert von 1/1 sagt nichts über die übrigen Tage aus. Der Export enthält zusätzlich ausdrücklich „Nicht geprüft“-Zeilen für unbekannte Tage.</p>
 </section>;
}
