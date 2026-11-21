'use client';
import {useEffect,useState} from 'react';
import {trustedGuideUrl} from '../../lib/psn-trophy-guide-links.mjs';
import styles from './TrophyGuideIndexPanel.module.css';

const sourceUrl='https://github.com/langdonx/trophy-guide-list-json';
const matchLabel={
 exact:'Titel exakt', 'title-guide':'Titel + Guide-Bezeichnung',
 'related-title':'Ähnlicher Titel – Edition prüfen'
};
export default function TrophyGuideIndexPanel({title,onChoose}){
 const [loading,setLoading]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [matches,setMatches]=useState([]);
 const [error,setError]=useState('');
 useEffect(()=>{setLoading(false);setLoaded(false);setMatches([]);setError('')},[title]);
 async function lookup(){
  if(loading||!title)return;
  setLoading(true);setError('');
  try{
   const response=await fetch('/mein-playstation/api/trophy-guide-index?'+new URLSearchParams({title}),{
    credentials:'same-origin',cache:'no-store'
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Guide-Daten nicht verfügbar');
   if(!Array.isArray(result.matches))throw Error('Guide-Index liefert ungültige Daten');
   setMatches(result.matches.filter(x=>trustedGuideUrl(x?.url)&&typeof x.title==='string').slice(0,8));
   setLoaded(true);
  }catch(e){setError(e.message||'Guide-Suche nicht verfügbar.')}
  finally{setLoading(false)}
 }
 return <section className={styles.root} aria-label="Externer Trophy-Guide-Index">
  <div className={styles.head}>
   <div><span className={styles.kicker}>COMMUNITY GUIDE INDEX</span>
    <h5>GUIDES UND PLATINZEITEN FINDEN</h5>
    <p>Durchsuche den öffentlichen Guide-Index nach diesem Spiel. Die Vorschläge werden <strong>nicht automatisch</strong> deiner Sony-Trophäenliste zugeordnet.</p>
   </div>
   <button type="button" className={styles.search} onClick={lookup} disabled={loading||!title}>
    {loading?'SUCHE LÄUFT …':loaded?'ERNEUT SUCHEN':'GUIDES IM INDEX SUCHEN'}</button>
  </div>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {loaded&&matches.length===0?<p role="status" className={styles.hint}>Kein eindeutig passender Guide-Titel im Index gefunden. Nutze darunter die reguläre externe Guide-Suche.</p>:null}
  {matches.length>0?<div className={styles.results} aria-label="Gefundene Trophy-Guides">
   {matches.map((g,i)=><article className={styles.result} key={g.url}>
    <div className={styles.resultHead}><span className={styles.index}>{String(i+1).padStart(2,'0')}</span>
     <div><strong>{g.title}</strong><small>{g.source} · {matchLabel[g.match]||'Titel prüfen'}{g.platforms?.length?' · '+g.platforms.join(' / '):''}</small></div>
    </div>
    <div className={styles.facts}>
     {g.difficulty!==null?<span>Schwierigkeit: <strong>{g.difficulty}/10</strong></span>:null}
     {g.hours!==null?<span>Platin-/Guidezeit: <strong>{g.hours} h</strong></span>:null}
     {g.playthroughs!==null?<span>Durchläufe: <strong>{g.playthroughs}</strong></span>:null}
     {g.hasMissable?<span className={styles.warning}>Verpassbare Trophäen markiert</span>:null}
     {g.hasOnline?<span className={styles.warning}>Online-Trophäen markiert</span>:null}
     {g.hasBuggy?<span className={styles.warning}>Fehlerhafte Trophäen markiert</span>:null}
     {g.isDlc?<span className={styles.warning}>DLC-Guide</span>:null}
    </div>
    <div className={styles.actions}><a href={g.url} target="_blank" rel="noopener noreferrer">GUIDE PRÜFEN</a>
     <button type="button" onClick={()=>onChoose(g)}>LINK ÜBERNEHMEN</button></div>
   </article>)}
  </div>:null}
  <p className={styles.note}>Quelle: <a href={sourceUrl} target="_blank" rel="noopener noreferrer">langdonx/trophy-guide-list-json</a>. Community-Angaben sind nicht von Sony bestätigt; unbekannte Werte werden ausgelassen. „Nicht markiert“ bedeutet nicht „garantiert ohne verpassbare Trophäen“. Ein Link wird erst nach deiner Prüfung und dem Speichern im persönlichen Guide-Log übernommen.</p>
 </section>;
}
