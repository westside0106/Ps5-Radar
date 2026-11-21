'use client';
import {useMemo} from 'react';
import {buildPlaytimeInsights,buildTrophyInsights} from '../../lib/psn-advanced-stats.mjs';
import styles from './AdvancedStats.module.css';

const hours=n=>n===null?'—':(n/60).toLocaleString('de-DE',{maximumFractionDigits:1})+' h';
function Distribution({rows=[],empty='Keine Daten',unit='Sets'}){
 const max=Math.max(1,...rows.map(x=>x.count));
 return <div className={styles.chart}>
  {rows.some(x=>x.count>0)?rows.map(row=><div className={styles.barRow} key={row.label}>
   <span>{row.label}</span><div className={styles.track} role="img" aria-label={row.label+': '+row.count+' '+unit}><span style={{width:(row.count/max*100)+'%'}}/></div><strong>{row.count}</strong>
  </div>):<p className={styles.note}>{empty}</p>}
 </div>;
}
export default function AdvancedStats({played=[],titles=[]}){
 const play=useMemo(()=>buildPlaytimeInsights(played),[played]);
 const trophy=useMemo(()=>buildTrophyInsights(titles),[titles]);
 const maxGenre=Math.max(1,...play.genres.map(g=>g.minutes));
 return <section className={styles.root} aria-label="Erweiterte PSN-Spiel- und Trophäenstatistiken">
  <div className={styles.heading}><div><span className={styles.kicker}>PSN DATENANALYSE</span><h4>Deine Gaming-Statistiken</h4><p>Verifizierbare Auswertung der vorhandenen PSN-Daten. Keine simulierten Spielsessions oder geschätzten Freischaltungen.</p></div><span className={styles.tag}>Neue Auswertung</span></div>
  <div className={styles.metrics}>
   <div><small>Spiele mit PSN-Spielzeit</small><strong>{play.knownGames}</strong><span>{play.unknownGames} ohne auswertbare Spielzeit</span></div>
   <div><small>Ø Spielzeit je erfasstem Titel</small><strong>{hours(play.averageMinutes)}</strong><span>Nur Titel mit bekanntem PSN-Wert</span></div>
   <div><small>Median der Spielzeit</small><strong>{hours(play.medianMinutes)}</strong><span>Weniger verzerrt durch Langzeitspiele</span></div>
   <div><small>Platin-Trophäenlisten</small><strong>{trophy.platinumSets}</strong><span>{trophy.completedSets} Sets mit 100 % Fortschritt</span></div>
  </div>
  <div className={styles.panels}>
   <section className={styles.panel}><h5>Spielzeit-Verteilung</h5><p>So viele erfasste Titel fallen in die jeweilige Spielzeitklasse.</p>
    <Distribution rows={play.bands} empty="Noch keine PSN-Spielzeiten erfasst." unit="Spiele"/>
   </section>
   <section className={styles.panel}><h5>Trophäenfortschritt</h5><p>Jeweils eine PSN-Trophäenliste, einschließlich gegebenenfalls separater PS4-/PS5-Versionen.</p>
    <Distribution rows={trophy.bands} empty="Keine vollständigen Fortschrittswerte verfügbar." unit="Trophäenlisten"/>
    {trophy.unknownSets>0?<small>{trophy.unknownSets} Listen ohne gültigen Fortschrittswert nicht mitgezählt.</small>:null}
   </section>
   <section className={styles.panel}><h5>Genres nach Spielzeit</h5><p>Nur zugeordnete IGDB-/PSN-Genres. Spiele mit mehreren Genres zählen in jeder passenden Kategorie.</p>
    {play.genres.length?<div className={styles.genreList}>{play.genres.map(g=><div key={g.name} className={styles.genreItem}>
     <div><strong>{g.name}</strong><span>{hours(g.minutes)} · {g.games} Titel</span></div>
     <div className={styles.track} role="img" aria-label={g.name+': '+hours(g.minutes)}><span style={{width:(g.minutes/maxGenre*100)+'%'}}/></div>
    </div>)}</div>:<p className={styles.note}>Für die erfassten Spiele sind noch keine eindeutigen Genre-Metadaten hinterlegt.</p>}
   </section>
   <section className={styles.panel}><h5>Trophäen-Sammlung</h5><p>Von Sony gemeldete erhaltene Trophäen, ohne Zusammenrechnung von Basis-/DLC-Fortschritt zu einer vermeintlichen Platin.</p>
    <div className={styles.medals}>{[['platinum','Platin'],['gold','Gold'],['silver','Silber'],['bronze','Bronze']].map(([type,label])=><div key={type}><strong>{trophy.earned[type].toLocaleString('de-DE')}</strong><small>{label}</small></div>)}</div>
    {trophy.completedWithoutPlatinum>0?<p className={styles.warning}>{trophy.completedWithoutPlatinum} Sets mit 100 % Fortschritt, aber ohne nachgewiesene Platin-Trophäe.</p>:null}
   </section>
  </div>
  <p className={styles.footer}>Datenstand: aktuell abgerufene PSN-Spiele und Trophäenlisten. Spielzeiten sind kumulierte Werte, keine Sitzungshistorie. PSN-Trophäenlisten können DLCs enthalten. Werte ohne Datengrundlage bleiben unbekannt.</p>
 </section>;
}
