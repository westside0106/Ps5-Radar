'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import styles from './SourceScanAuditPanel.module.css';

function stamp(value){
 const ms=Date.parse(value||'');
 return Number.isFinite(ms)?new Intl.DateTimeFormat('de-DE',{
  timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'
 }).format(ms):'—';
}
function label(run,nowMs){
 if(run.result==='success')return 'Erfolgreich';
 if(run.result==='failed')return 'Fehlgeschlagen';
 if(run.result==='running'){
  return nowMs-Date.parse(run.started_at)>120000?'Ohne Abschluss':'Läuft';
 }
 return 'Unbekannt';
}
function todaySchedule(runs,nowMs){
 const now=new Date(nowMs);
 const day=now.toISOString().slice(0,10);
 const today=runs.some(x=>x.run_kind==='scheduled'&&String(x.started_at||'').slice(0,10)===day);
 if(today)return {tone:'ok',text:'Heute ist ein automatischer Lauf protokolliert.'};
 const utcMinute=now.getUTCHours()*60+now.getUTCMinutes();
 if(utcMinute<540)return {tone:'pending',text:'Der automatische Tageslauf ist für 09:00 UTC vorgesehen.'};
 if(utcMinute<600)return {tone:'pending',text:'Das geplante Cron-Zeitfenster läuft (09:00–10:00 UTC).'};
 return {tone:'caution',text:'Für heute ist noch kein automatischer Lauf protokolliert. Das ist kein Beweis für einen Ausfall; Cron-Ausführung und Protokollspeicher prüfen.'};
}
export default function SourceScanAuditPanel(){
 const [runs,setRuns]=useState([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const [updated,setUpdated]=useState('');
 const load=useCallback(async signal=>{
  const response=await fetch('/zentrale/api/source-runs',{
   credentials:'same-origin',cache:'no-store',signal
  });
  if(!response.ok)throw Error(response.status===401?'Sitzung abgelaufen.':'Prüfprotokoll nicht erreichbar.');
  const data=await response.json();
  if(!Array.isArray(data.runs))throw Error('Ungültige Prüfprotokoll-Antwort.');
  return data.runs;
 },[]);
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  async function refresh(){
   if(!active||document.visibilityState==='hidden')return;
   setRefreshing(true);
   try{
    const result=await load(controller.signal);
    if(active){setRuns(result);setError('');setUpdated(new Date().toISOString())}
   }catch(e){if(active&&!controller.signal.aborted)setError(e.message||'Abfrage fehlgeschlagen')}
   finally{if(active)setRefreshing(false);if(active)setLoading(false)}
  }
  void refresh();
  const timer=setInterval(()=>{void refresh()},120000);
  const onScan=()=>{void refresh()};
  const onVisible=()=>{if(document.visibilityState==='visible')void refresh()};
  window.addEventListener('radar:source-scan-complete',onScan);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{active=false;clearInterval(timer);controller.abort();
   window.removeEventListener('radar:source-scan-complete',onScan);
   document.removeEventListener('visibilitychange',onVisible)};
 },[load]);
 const nowMs=Date.now();
 const info=useMemo(()=>todaySchedule(runs,nowMs),[runs,nowMs]);
 const latestScheduled=runs.find(x=>x.run_kind==='scheduled');
 const latestManual=runs.find(x=>x.run_kind==='manual');
 return <section className={styles.root} aria-label="Quellen-Prüfprotokoll">
  <div className={styles.head}>
   <div><span className={styles.kicker}>EXECUTION RECEIPTS / PRIVATE</span>
    <h3>PRÜFPROTOKOLL <em>UND CRON-STATUS</em></h3>
    <p>Hier siehst du die tatsächlichen Server-Prüfversuche – getrennt nach automatischem Tageslauf und manuellem Sofortcheck. Ein erreichbarer Anbieter beweist noch nicht, dass der geplante Job lief.</p></div>
   <button type="button" className={styles.refresh} onClick={async()=>{
    if(refreshing)return;setRefreshing(true);
    try{const data=await load();setRuns(data);setUpdated(new Date().toISOString());setError('')}
    catch(e){setError(e.message||'Abfrage fehlgeschlagen')}
    finally{setRefreshing(false);setLoading(false)}
   }} disabled={refreshing}>{refreshing?'AKTUALISIERE …':'PROTOKOLL AKTUALISIEREN'}</button>
  </div>
  <div className={styles.schedule} data-tone={info.tone}>
   <strong>Automatischer Tagescheck · 09:00 UTC</strong>
   <span>{info.text}</span>
   <small>Ein Cron-Eintrag wird erst ab dieser Version gespeichert. Die Ausführung kann innerhalb des vorgesehenen Zeitfensters verzögert sein.</small>
  </div>
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  <div className={styles.counters}>
   <div><span>Letzter automatischer Lauf</span><strong>{latestScheduled?label(latestScheduled,nowMs):'Noch keiner'}</strong>
    <small>{latestScheduled?stamp(latestScheduled.started_at):'Kein Eintrag seit Beginn der Protokollierung'}</small></div>
   <div><span>Letzter Sofortcheck</span><strong>{latestManual?label(latestManual,nowMs):'Noch keiner'}</strong>
    <small>{latestManual?stamp(latestManual.started_at):'Nach neuer Sofortprüfung hier sichtbar'}</small></div>
  </div>
  {loading?<p className={styles.subtle}>Prüfprotokoll wird geladen …</p>:null}
  {!loading&&!runs.length?<p className={styles.subtle}>Noch keine protokollierten Prüfläufe. Bereits früher gespeicherte Tagesmessungen bleiben separat erhalten und werden nicht rückwirkend als neue Ausführungen ausgegeben.</p>:null}
  {runs.length?<div className={styles.tableScroll}>
   <table aria-label="Letzte tatsächliche Quellenprüfungen">
    <thead><tr><th scope="col">Start</th><th scope="col">Auslöser</th><th scope="col">Ergebnis</th>
     <th scope="col">Quellen</th><th scope="col">Dauer</th><th scope="col">ntfy</th></tr></thead>
    <tbody>{runs.slice(0,12).map(run=><tr key={run.id}>
     <th scope="row">{stamp(run.started_at)}</th>
     <td>{run.run_kind==='scheduled'?'Cron':'Manuell'}</td>
     <td><span className={styles.pill} data-result={run.result}>{label(run,nowMs)}</span></td>
     <td>{run.result==='success'&&run.healthy_count!=null
      ?`${run.healthy_count} gesund / ${(run.error_count??0)+(run.degraded_count??0)} beeinträchtigt`:'—'}</td>
     <td>{Number.isFinite(run.duration_ms)?(run.duration_ms/1000).toFixed(1)+' s':'—'}</td>
     <td>{run.result==='success'?(run.push_accepted??0)+' angenommen'+
      (run.push_failed?' · '+run.push_failed+' fehlgeschlagen':''):'—'}</td>
    </tr>)}</tbody>
   </table>
  </div>:null}
  <p className={styles.foot}>„Erfolgreich“ heißt: Der Check wurde ausgeführt und gespeichert – nicht, dass alle sechs Anbieter erreichbar waren. „ntfy angenommen“ belegt nur die Übergabe an ntfy, nicht den Empfang auf deinem iPhone. Bei einer abgebrochenen Serverfunktion kann ein Lauf ohne Abschluss stehen bleiben. {updated?'Letzte Anzeigeaktualisierung: '+stamp(updated)+'.':''}</p>
 </section>;
}
