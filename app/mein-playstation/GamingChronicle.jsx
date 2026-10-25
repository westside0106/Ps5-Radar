'use client';
import {useMemo,useState} from 'react';
import {normalizeSnapshotHistory,snapshotMonths,lastPlayedEvents} from '../../lib/psn-gaming-insights.mjs';

function localized(day){return new Date(day+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'short',year:'numeric'})}
function monthLabel(value){return new Date(value+'-15T12:00:00').toLocaleDateString('de-DE',{month:'short',year:'2-digit'})}
export default function GamingChronicle({played=[],history=[]}){
 const [months,setMonths]=useState(6),[limit,setLimit]=useState(12),[mode,setMode]=useState('all');
 const readings=useMemo(()=>normalizeSnapshotHistory(history),[history]);
 const allMonthly=useMemo(()=>snapshotMonths(readings,months),[readings,months]);
 const observed=useMemo(()=>lastPlayedEvents(played,100),[played]);
 const visible=mode==='with-date'?observed.filter(e=>e.dateKey):observed;
 const latest=readings.at(-1);
 const comparable=allMonthly.reduce((s,m)=>s+m.validPairs,0);
 const max=Math.max(1,...allMonthly.map(m=>m.indicativeMinutes));
 return <section className="psn-chronicle" aria-label="Meine Gaming-Chronik">
  <div className="psn-chronicle-head"><div><span className="psn-eyebrow">PLAYSTATION · DEINE CHRONIK</span><h4>Gaming-Chronik</h4><p>Dein PSN-Verlauf aus bekannten letzten Spieldaten und lokal gespeicherten Messpunkten – keine erfundene Sitzungs-Historie.</p></div><span className="psn-chronicle-reading">{readings.length} Messpunkte</span></div>
  <div className="psn-chronicle-summary">
   <div><small>Zuletzt gemeldete Titel</small><strong>{observed.length}{played.length>observed.length?' +':''}</strong><span>Bis zu 100 mit gültigem PSN-Datum</span></div>
   <div><small>Letzter PSN-Gesamtwert</small><strong>{latest?Math.round(latest.minutes/60).toLocaleString('de-DE')+' h':'—'}</strong><span>{latest?'Lokal gemessen am '+localized(latest.date):'Noch kein Snapshot gespeichert'}</span></div>
   <div><small>Vergleichbare Messpaare</small><strong>{comparable}</strong><span>Im gewählten Monatsfenster</span></div>
  </div>
  <div className="psn-chronicle-panel">
   <div className="psn-chronicle-panel-header"><div><h5>Spielzeit zwischen Messpunkten</h5><p>Indikative Differenz der kumulierten PSN-Zeit; kein Nachweis tatsächlicher Stunden pro Monat.</p></div>
    <div className="psn-chronicle-periods" role="group" aria-label="Zeitraum">
     {[3,6,12].map(value=><button type="button" key={value} aria-pressed={months===value} onClick={()=>setMonths(value)}>{value} Mon.</button>)}
    </div>
   </div>
   {allMonthly.length?<div className="psn-chronicle-chart" role="img" aria-label="Monatliche indikative Differenzen der PSN-Snapshots">
    {allMonthly.map(month=><div key={month.month} className="psn-chronicle-month">
     <div className="psn-chronicle-column" title={monthLabel(month.month)+': '+(month.indicativeMinutes/60).toLocaleString('de-DE',{maximumFractionDigits:1})+' Std. indikative Differenz aus '+month.validPairs+' vergleichbaren Paaren'}>
      <span style={{height:Math.max(3,month.indicativeMinutes/max*100)+'%'}}/>
     </div>
     <strong>{month.indicativeMinutes>0?(month.indicativeMinutes/60).toLocaleString('de-DE',{maximumFractionDigits:1})+' h':'—'}</strong>
     <small>{monthLabel(month.month)}</small>
     {month.uncertainPairs?<small className="psn-chronicle-warning">{month.uncertainPairs} unsicher</small>:null}
    </div>)}
   </div>:<p className="psn-muted">Noch keine lokalen Messpunkte vorhanden. Der Verlauf entsteht beim späteren erneuten Aufrufen deiner PSN-Seite.</p>}
   <p className="psn-chronicle-annotation">Nur nichtnegative Differenzen bei gleichbleibender Anzahl gemeldeter Spiele werden dargestellt. Auch dann kann sich die Zusammensetzung der Spiele geändert haben. Bei fehlenden Messtagen wird die Differenz dem späteren Messmonat zugerechnet.</p>
  </div>
  <div className="psn-chronicle-panel">
   <div className="psn-chronicle-panel-header"><div><h5>Zuletzt gemeldete Spieldaten</h5><p>Für jeden Titel kennt PSN hier nur den <strong>letzten</strong> Spielzeitpunkt – nicht jeden Besuch oder jede Sitzung.</p></div></div>
   {visible.length?<div className="psn-chronicle-timeline">{visible.slice(0,limit).map((e,i)=><div className="psn-chronicle-event" key={e.id+'-'+i}>
    <span className="psn-chronicle-event-point" aria-hidden="true"/>
    <div><small>{localized(e.dateKey)} · PSN zuletzt gespielt</small><strong>{e.title}</strong></div>
   </div>)}</div>:<p className="psn-muted">Keine Titel mit gültigem „Zuletzt gespielt“-Datum verfügbar.</p>}
   {visible.length>limit?<button type="button" className="psn-chronicle-more" onClick={()=>setLimit(n=>Math.min(100,n+12))}>Weitere Einträge ({visible.length-limit} übrig)</button>:null}
  </div>
 </section>;
}
