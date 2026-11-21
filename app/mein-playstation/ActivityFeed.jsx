'use client';
import {useEffect,useMemo,useState} from 'react';
import {TROPHY_DATES_KEY,TROPHY_DATES_EVENT,normalizeTrophyDates} from '../../lib/psn-trophy-heatmap.mjs';
import {buildPersonalActivityFeed} from '../../lib/psn-activity-feed.mjs';
import styles from './ActivityFeed.module.css';

const dateLabel=day=>new Date(day+'T12:00:00Z').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
const clockLabel=at=>new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(at));
const kinds={all:'ALLE EREIGNISSE',trophy:'TROPHÄEN','last-played':'SPIELE'};
export default function ActivityFeed({played=[],titles=[]}){
 const [trophyDates,setTrophyDates]=useState([]);
 const [filter,setFilter]=useState('all');
 const [count,setCount]=useState(8);
 useEffect(()=>{
  const read=()=>{try{setTrophyDates(normalizeTrophyDates(JSON.parse(localStorage.getItem(TROPHY_DATES_KEY)||'[]')))}catch{setTrophyDates([])}};
  read();
  window.addEventListener(TROPHY_DATES_EVENT,read);
  window.addEventListener('storage',read);
  return()=>{window.removeEventListener(TROPHY_DATES_EVENT,read);window.removeEventListener('storage',read)};
 },[]);
 const activity=useMemo(()=>buildPersonalActivityFeed({played,titles,trophyDates}),[played,titles,trophyDates]);
 const filtered=useMemo(()=>filter==='all'?activity.events:activity.events.filter(e=>e.kind===filter),[activity.events,filter]);
 const display=filtered.slice(0,count);
 const shownDays=new Set();
 return <section id="psn-activity-feed" className={styles.root} aria-label="Dein Gaming Activity Feed">
  <div className={styles.grid} aria-hidden="true"/>
  <header className={styles.header}>
   <div><span className={styles.kicker}><span className={styles.dot}/> LIVE FROM YOUR HISTORY · SOURCE VERIFIED</span>
    <h4>DEIN GAMING-<em>PULS.</em></h4>
    <p>Erinnerungen aus echten PSN-Daten, kombiniert zu einem persönlichen Verlauf. Jede Aktivität ist mit ihrer tatsächlichen Datenquelle gekennzeichnet.</p>
   </div>
   <div className={styles.pulse} aria-hidden="true"><span/><i/><span/><i/><span/></div>
  </header>
  <div className={styles.metrics}>
   <div><small>ERFASSTE FREISCHALTUNGEN</small><strong>{activity.trophyUnlocks.toLocaleString('de-DE')}</strong><span>Aus {activity.knownTrophySets} geöffneten PSN-Listen</span></div>
   <div><small>ZULETZT GESPIELTE TITEL</small><strong>{activity.knownLastPlayed.toLocaleString('de-DE')}</strong><span>Jeweils ein PSN-Zeitpunkt pro Spiel</span></div>
   <div><small>TAGE MIT BEKANNTEM EREIGNIS</small><strong>{activity.activeDates.toLocaleString('de-DE')}</strong><span>Teilweise Abdeckung · kein Sessions-Tracker</span></div>
  </div>
  <div className={styles.feedHead}>
   <div><span className={styles.subheading}>CHRONOLOGICAL ACTIVITY LOG</span><p>Neueste gemeldete Aktivitäten zuerst</p></div>
   <div className={styles.filters} role="group" aria-label="Aktivitätstyp wählen">
    {Object.entries(kinds).map(([key,name])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>{setFilter(key);setCount(8)}}>{name}</button>)}
   </div>
  </div>
  <div className={styles.timeline} aria-live="polite">
   {display.length?display.map((event,index)=>{
    const dayHeading=!shownDays.has(event.day);
    shownDays.add(event.day);
    return <div key={event.id} className={styles.entryGroup}>
     {dayHeading?<div className={styles.day}><span>{dateLabel(event.day)}</span><i/></div>:null}
     <article className={styles.item}>
      <div className={styles.rail}><span className={event.kind==='trophy'?styles.trophyIcon:styles.gameIcon} aria-hidden="true">{event.kind==='trophy'?'✦':'▶'}</span></div>
      <div className={styles.content}>
       <div className={styles.meta}><span className={event.kind==='trophy'?styles.trophyTag:styles.gameTag}>{event.kind==='trophy'?'TROPHY UNLOCK':'LAST PLAYED'}</span><time dateTime={event.at}>{event.kind==='trophy'?'Letzte Freischaltung ':'Zuletzt '}{clockLabel(event.at)} Uhr</time></div>
       <strong>{event.title}</strong>
       <p>{event.kind==='trophy'?event.count===1?'Eine lokal erfasste Trophäen-Freischaltung':event.count+' lokal erfasste Trophäen-Freischaltungen':'Einziger von PSN gemeldeter letzter Spielzeitpunkt dieses Titels'}</p>
      </div>
      <span className={styles.source}>{event.kind==='trophy'?'PSN TROPHY CACHE':'PSN LAST PLAYED'}</span>
     </article>
    </div>;
   }):<p className={styles.empty}>Keine passenden Einträge. Trophäen-Freischaltungen werden erfasst, sobald du deren PSN-Trophäenlisten öffnest. Letzte Spielzeitpunkte stammen direkt aus deiner PSN-Liste.</p>}
  </div>
  {filtered.length>count?<button className={styles.more} type="button" onClick={()=>setCount(n=>Math.min(300,n+10))}>WEITERE AKTIVITÄTEN LADEN <span>{filtered.length-count} übrig ↘</span></button>:null}
  <footer className={styles.footer}><span>DATA INTEGRITY // {activity.knownTrophySets} beobachtete Trophäenlisten</span><p>Die Timeline ist unvollständig, solange Trophäenlisten nicht einzeln abgerufen wurden. Sie enthält keine erfundenen Spielstarts, Sitzungsdauern, Abschlüsse oder rückwirkend rekonstruierten Erfolge.</p></footer>
 </section>;
}
