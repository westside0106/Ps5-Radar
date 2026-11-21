'use client';
import {useEffect,useMemo,useState} from 'react';
import {buildPlaytimeGoalInsights,TIME_GOAL_TYPES} from '../../lib/psn-playtime-goals.mjs';
import {PSN_MONITOR_KEY,PSN_MONITOR_EVENT,normalizeObservedSessions} from '../../lib/psn-monitor-import.mjs';
import styles from './PlaytimeGoalsLab.module.css';

const hour=n=>n===null||n===undefined?'—':(n/60).toLocaleString('de-DE',{maximumFractionDigits:1})+' h';
const hours=n=>n===null||n===undefined?'—':n.toLocaleString('de-DE',{maximumFractionDigits:1})+' h';
const stamp=value=>{
 try{return new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(value))}
 catch{return 'unbekannt'}
};
function showEditor(key){
 window.dispatchEvent(new CustomEvent('psn-plan-game',{detail:{id:key}}));
}
export default function PlaytimeGoalsLab({games=[],notes={}}){
 const [observed,setObserved]=useState([]);
 const [filter,setFilter]=useState('relevant');
 const [search,setSearch]=useState('');
 const [limit,setLimit]=useState(8);
 useEffect(()=>{
  const refresh=()=>{try{setObserved(normalizeObservedSessions(JSON.parse(localStorage.getItem(PSN_MONITOR_KEY)||'[]')))}catch{setObserved([])}};
  refresh();
  window.addEventListener(PSN_MONITOR_EVENT,refresh);
  window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener(PSN_MONITOR_EVENT,refresh);window.removeEventListener('storage',refresh)};
 },[]);
 const data=useMemo(()=>buildPlaytimeGoalInsights(games,notes,observed),[games,notes,observed]);
 const candidates=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('de');
  const visible=data.rows.filter(row=>{
   if(q&&!row.name.toLocaleLowerCase('de').includes(q))return false;
   if(filter==='goals')return row.goalHours!==null;
   if(filter==='observed')return row.observedSessions>0;
   if(filter==='relevant')return row.goalHours!==null||row.observedSessions>0||row.communityPlatinumHours!==null;
   return true;
  });
  return visible.sort((a,b)=>
   Number(b.goalHours!==null)-Number(a.goalHours!==null)
   ||Number(b.observedSessions>0)-Number(a.observedSessions>0)
   ||Number(b.priority==='high')-Number(a.priority==='high')
   ||(b.observedMinutes-a.observedMinutes)
   ||a.name.localeCompare(b.name,'de'));
 },[data.rows,search,filter]);
 return <section id="psn-playtime-goals-lab" className={styles.root} aria-label="Spielzeit-Labor und persönliche Zeitziele">
  <header className={styles.header}>
   <div><span className={styles.kicker}><span className={styles.pulse}/> TIME INTELLIGENCE // PERSONAL TARGETS</span>
    <h4>SPIELZEIT-<em>LABOR</em></h4>
    <p>Drei unterschiedliche Datenarten, sauber getrennt: kumulierte PSN-Spielzeit, tatsächlich beobachtete Monitor-Intervalle und deine selbst gesetzten Zeitziele.</p>
   </div>
   <div className={styles.mark} aria-hidden="true">H<span>:</span>M</div>
  </header>
  <div className={styles.metrics}>
   <div><small>PERSÖNLICHE ZEITZIELE</small><strong>{data.goalCount}</strong><span>Explizit in deinem Spielplan gespeichert</span></div>
   <div><small>MIT PSN-WERT VERGLEICHBAR</small><strong>{data.comparable}</strong><span>Kein Nachweis für Spielabschluss</span></div>
   <div><small>BEOBACHTETE INTERVALLE</small><strong>{data.observedSessions}</strong><span>{hour(data.observedSessions?data.observedTotalMinutes:null)} im Monitor-Fenster</span></div>
   <div><small>NICHT ZUGEORDNET</small><strong>{data.unmatchedObservations.reduce((n,x)=>n+x.sessions,0)}</strong><span>Keine automatische Zuordnung auf Verdacht</span></div>
  </div>
  <div className={styles.explain}>
   <div><span className={styles.sourceDot} data-source="sony"/> <strong>SONY / PSN</strong><small>Gesamtspielzeit je Titel, kein Sitzungsprotokoll</small></div>
   <div><span className={styles.sourceDot} data-source="monitor"/> <strong>MONITOR</strong><small>Nur beobachtete, abgeschlossene Intervalle</small></div>
   <div><span className={styles.sourceDot} data-source="goal"/> <strong>DEIN ZIEL</strong><small>Persönlicher Richtwert, keine automatisch berechnete Restdauer</small></div>
  </div>
  {data.observationRange?<p className={styles.range}>Erfasstes Monitor-Zeitfenster: {stamp(data.observationRange.start)} bis {stamp(data.observationRange.end)} · Keine rückwirkend vollständige Historie</p>:<p className={styles.range}>Noch keine abgeschlossenen Monitor-Intervalle. Nach einem beobachteten Spielwechsel oder Spielende erscheinen hier ergänzende Daten.</p>}
  <div className={styles.controls}>
   <label>ANZEIGE
    <select value={filter} onChange={e=>{setFilter(e.target.value);setLimit(8)}}>
     <option value="relevant">Mit Zeitwerten oder Schätzung</option>
     <option value="goals">Meine Zeitziele</option>
     <option value="observed">Mit Monitor-Sitzungen</option>
     <option value="all">Alle Spiele</option>
    </select>
   </label>
   <label>SPIEL SUCHEN
    <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(8)}} placeholder="Im Spielzeit-Labor suchen …" maxLength={120}/>
   </label>
   <span className={styles.count}>{candidates.length} TITEL</span>
  </div>
  <div className={styles.list}>
   {candidates.length?candidates.slice(0,limit).map(row=><article key={row.key} className={styles.game}>
    <div className={styles.gameHead}>
     <div><strong>{row.name}</strong><span>{row.goalHours!==null?TIME_GOAL_TYPES[row.goalKind]+' · '+hours(row.goalHours):row.communityPlatinumHours!==null?'Historische Community-Platin-Schätzung: '+hours(row.communityPlatinumHours):'Noch kein persönliches Zeitziel'}</span></div>
     <button type="button" onClick={()=>showEditor(row.key)} aria-label={'Zeitplan für '+row.name+' bearbeiten'}>ZIEL BEARBEITEN <span aria-hidden="true">↗</span></button>
    </div>
    <div className={styles.gameMetrics}>
     <div><small>PSN · KUMULIERT</small><strong>{hour(row.psnMinutes)}</strong></div>
     <div><small>MONITOR · BEOBACHTET</small><strong>{row.observedSessions?hour(row.observedMinutes):'—'}</strong><small>{row.observedSessions?row.observedSessions+' Intervalle, Titel exakt zugeordnet':'Keine sichere Zuordnung'}</small></div>
     <div><small>DEIN ZEITZIEL</small><strong>{hours(row.goalHours)}</strong></div>
    </div>
    {row.progressPct!==null?<div className={styles.progress}>
     <div className={styles.progressMeta}><span>PSN-Spielzeit relativ zu deinem Zielwert</span><strong>{row.progressPct}%</strong></div>
     <div className={styles.track} role="progressbar" aria-label={'PSN-Spielzeit relativ zum persönlichen Ziel für '+row.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.progressPct}><span style={{width:row.progressPct+'%'}}/></div>
     <p>{row.distanceMinutes>0?hour(row.distanceMinutes)+' Abstand zum Zielwert – keine verlässliche Restspielzeit.':'PSN-Gesamtspielzeit erreicht oder überschreitet deinen Zielwert; der Spielabschluss ist damit nicht bestätigt.'}</p>
    </div>:<p className={styles.missing}>{row.goalHours===null?'Lege im Spielplan einen eigenen Stundenwert fest, um einen PSN-Vergleich zu erhalten.':'Kein gültiger kumulierter PSN-Spielzeitwert – Fortschritt bleibt unbekannt.'}</p>}
   </article>):<p className={styles.empty}>Keine passenden Spiele. Wähle „Alle Spiele“ oder trage unter „Spiele planen &amp; Backlog“ ein persönliches Zeitziel ein.</p>}
   {candidates.length>limit?<button className={styles.more} type="button" onClick={()=>setLimit(n=>n+12)}>WEITERE {Math.min(12,candidates.length-limit)} TITEL ANZEIGEN ↘</button>:null}
  </div>
  {data.unmatchedObservations.length?<details className={styles.unmatched}><summary>NICHT ZUGEORDNETE MONITOR-TITEL ({data.unmatchedObservations.length})</summary>
   <p>Abweichende oder mehrdeutige Titel werden bewusst nicht mit PS4-/PS5-Einträgen zusammengerechnet. Sie bleiben in der eigenständigen Monitor-Auswertung erhalten.</p>
   <div>{data.unmatchedObservations.slice(0,15).map((v,i)=><div key={i}><strong>{v.name}</strong><span>{v.reason} · {v.sessions} Intervalle · {hour(v.minutes)}</span></div>)}</div>
  </details>:null}
  <p className={styles.footer}>Community-Schätzungen sind als historische Vergleichswerte gekennzeichnet. Sie werden nicht automatisch als persönliches Ziel übernommen. Monitor-Minuten dürfen nicht zur bereits kumulierten Sony-Spielzeit addiert werden.</p>
 </section>;
}
