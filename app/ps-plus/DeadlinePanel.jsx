'use client';
import styles from './DeadlinePanel.module.css';

function labelDate(iso){
 const date=new Date(iso+'T12:00:00Z');
 return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
}
function remaining(days){
 return days===0?'Letzter Tag':days===1?'Noch 1 Tag':'Noch '+days+' Tage';
}
export default function DeadlinePanel({overview}){
 if(!overview)return null;
 const {claim,departures=[],sourceFresh,sourceCheckedAt,sourceUrl}=overview;
 return <section className={styles.root} aria-label="PS Plus Fristen-Radar">
  <div className={styles.head}>
   <div><span className={styles.eyebrow}>PS PLUS ATLAS // TIME INTELLIGENCE</span><h2>JEDER TAG <em>ZÄHLT.</em></h2>
    <p>Monatliche Spiele <strong>beanspruchen</strong> und Spielekatalog-Abgänge <strong>durchspielen</strong> sind verschiedene Vorgänge. Hier werden sie bewusst getrennt.</p>
   </div>
  </div>
  <div className={styles.grid}>
   <article className={styles.card}>
    <div className={styles.cardHeading}><h3>ESSENTIAL <small>// MONTHLY CLAIM</small></h3>{claim?<span className={styles.pill}>VERIFIZIERTE FRIST</span>:null}</div>
    {claim?<>
     <div className={styles.countdown} aria-label={remaining(claim.daysLeft)+" bis zum Beanspruchen"}><strong>{String(claim.daysLeft).padStart(2,"0")}</strong><div><span>DAYS</span><small>ZEIT ZUM<br/>BEANSPRUCHEN</small></div><i aria-hidden="true">✦</i></div>
     <p className={styles.deadline}>Bis <time dateTime={claim.deadline}>{labelDate(claim.deadline)}</time> zur Bibliothek hinzufügen</p>
     <ul className={styles.list}>{claim.games.map(game=><li key={game.title}>{game.storeUrl?<a href={game.storeUrl} rel="noreferrer" target="_blank">{game.title}</a>:<span>{game.title}</span>}</li>)}</ul>
     <p className={styles.note}>Diese Frist betrifft das Einlösen der Monatsspiele, nicht einen bestätigten Zeitpunkt, zu dem bereits beanspruchte Spiele entfernt werden.</p>
     <a className={styles.source} href={claim.sourceUrl} target="_blank" rel="noopener noreferrer">Offizielle Ankündigung prüfen ↗</a>
    </>:<p className={styles.note}>Aktuell keine belegte, noch laufende Beanspruchungsfrist. Die offizielle Monatsauswahl bitte direkt bei PlayStation prüfen.</p>}
   </article>
   <article className={styles.card}>
    <div className={styles.cardHeading}><h3>EXTRA / PREMIUM <small>// CATALOG EXITS</small></h3><span className={styles.pillMuted}>{departures.length} bestätigte Termine</span></div>
    {departures.length?<ul className={styles.departures}>{departures.slice(0,8).map(game=><li key={game.id}>
     <div><strong>{game.title}</strong><small>{game.services.map(s=>s==='extra'?'Extra':'Premium').join(' · ')}</small></div>
     <div><strong>{remaining(game.daysLeft)}</strong><small>Abgang am <time dateTime={game.deadline}>{labelDate(game.deadline)}</time></small>{Number.isFinite(game.estimatedHours)?<small>Erfasste Durchspielzeit: {game.estimatedHours} h (Schätzwert)</small>:null}</div>
    </li>)}</ul>
    :<p className={styles.note}>Für Extra/Premium liegen im vorhandenen Datensatz derzeit <strong>keine verifizierten Abgangstermine</strong> vor. Das bedeutet ausdrücklich nicht, dass keine Spiele entfernt werden.</p>}
    {!sourceFresh?<p className={styles.warning}>Der Katalog-Snapshot ist älter als 48 Stunden. Neue Katalogabgänge können fehlen.</p>:null}
    {sourceCheckedAt?<p className={styles.note}>Letzter Katalog-Snapshot: {labelDate(sourceCheckedAt)}.</p>:null}
    <a className={styles.source} href={sourceUrl} target="_blank" rel="noopener noreferrer">Offiziellen Spielekatalog prüfen ↗</a>
   </article>
  </div>
 </section>;
}
