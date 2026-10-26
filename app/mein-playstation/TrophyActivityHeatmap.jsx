'use client';
import {useEffect,useMemo,useState} from 'react';
import {TROPHY_ACTIVITY_KEY,recentTrophyDays} from '../../lib/psn-trophy-activity.mjs';
const german=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('de-DE',{day:'2-digit',month:'short',year:'numeric'});
const levels=n=>n<=0?0:n===1?1:n<=3?2:n<=6?3:4;
export default function TrophyActivityHeatmap(){
 const [events,setEvents]=useState({});
 useEffect(()=>{
  const sync=()=>{try{const v=JSON.parse(localStorage.getItem(TROPHY_ACTIVITY_KEY)||'{}');setEvents(v&&typeof v==='object'&&!Array.isArray(v)?v:{})}catch{setEvents({})}};
  sync();window.addEventListener('storage',sync);window.addEventListener('psn-trophy-activity-change',sync);
  return()=>{window.removeEventListener('storage',sync);window.removeEventListener('psn-trophy-activity-change',sync)};
 },[]);
 const result=useMemo(()=>recentTrophyDays(events,new Date(),364),[events]);
 return <section className="psn-trophy-heatmap" aria-label="Belegte Trophäen-Aktivität">
  <div className="psn-heatmap-head"><div><span className="psn-eyebrow">ECHTE PSN-FREISCHALTZEITEN</span><h3>Deine Trophy-Heatmap</h3><p>Nur Trophäen mit bestätigtem Freischaltzeitpunkt aus bereits geöffneten Sony-Trophäenlisten.</p></div>
  <div className="psn-heatmap-metrics"><strong>{result.total.toLocaleString('de-DE')}</strong><span>Erfasste Freischaltungen in 52 Wochen</span></div></div>
  <div className="psn-heatmap-scroll"><div className="psn-heatmap-calendar" role="img" aria-label={result.total+' lokal erfasste Trophäen-Freischaltungen an '+result.activeDays+' Tagen in 52 Wochen'}>
   {result.days.map(x=><span key={x.date} className={'psn-heatmap-cell level-'+levels(x.count)} title={german(x.date)+': '+x.count+' Trophäen'}/>)}
  </div></div>
  <div className="psn-heatmap-footer">
   <span>{result.activeDays} aktive Tage</span>
   <span>{result.peak.count?result.peak.count+' am '+german(result.peak.date):'Noch keine Zeitpunkte verfügbar'}</span>
   <div className="psn-heatmap-legend" aria-hidden="true"><span>Weniger</span>{[0,1,2,3,4].map(x=><b key={x} className={'psn-heatmap-cell level-'+x}/>)}<span>Mehr</span></div>
  </div>
  {!result.total?<p className="psn-heatmap-empty">Öffne in der Trophäen-Zentrale die Einzel-Trophäen eines PSN-Spiels oder lade die Trophäen eines Platin-Projekts. Falls Sony Freischaltzeitpunkte liefert, füllt sich die Heatmap. Nicht abgerufene Trophäen werden nicht geschätzt.</p>:null}
  <p className="psn-heatmap-note">Diese lokale Auswertung ist nicht deine vollständige PSN-Trophäenhistorie. Es wird nichts automatisch über alle Spiele hinweg im Hintergrund abgefragt. Die Datumszuordnung verwendet UTC.</p>
 </section>;
}
