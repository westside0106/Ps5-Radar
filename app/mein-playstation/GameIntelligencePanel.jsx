'use client';
import {useEffect,useMemo,useState} from 'react';
import {playDurationMinutes} from '../../lib/psn-advanced-stats.mjs';
import {normalizeTimeGoalHours} from '../../lib/psn-playtime-goals.mjs';
import styles from './GameIntelligencePanel.module.css';

const fmt=value=>Number.isFinite(value)?value.toLocaleString('de-DE',{maximumFractionDigits:1})+' h':'—';
const lang={official:'Offizielle Angabe',measured:'Unabhängig gemessen',
 reported:'Berichtet',unknown:'Nicht bestätigt'};
const int=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
export default function GameIntelligencePanel({game}){
 const title=String(game?.name||game?.titleName||'');
 const gameId=String(game?.titleId||title);
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [data,setData]=useState(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const psnMinutes=useMemo(()=>playDurationMinutes(game?.playDuration),[game?.playDuration]);
 useEffect(()=>{setBusy(false);setLoaded(false);setData(null);setError('');setNotice('')},[title,gameId]);
 async function load(){
  if(busy||title.trim().length<3)return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/mein-playstation/api/game-intelligence?'+new URLSearchParams({title}),{
    credentials:'same-origin',cache:'no-store'
   });
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Datenabruf fehlgeschlagen');
   setData(json);setLoaded(true);
  }catch(e){setError(e.message||'Datenquellen nicht erreichbar')}
  finally{setBusy(false)}
 }
 const fps=data?.framepatch?.match;
 const hltb=data?.howlongtobeat;
 const store=data?.store;
 const primary=hltb?.matches?.[0]||null;
 function useAsGoal(hours,kind){
  const rounded=Math.round(Number(hours)*2)/2;
  const validated=normalizeTimeGoalHours(rounded);
  if(validated===null||!gameId){setNotice('Schätzung kann nicht als persönliches Ziel übernommen werden.');return}
  window.dispatchEvent(new CustomEvent('psn-plan-game',{
   detail:{id:gameId,timeGoalHours:validated,timeGoalType:kind}
  }));
  setNotice('Stundenwert nur im Spielplan vorgemerkt. Bitte den Spielplan ausdrücklich speichern.');
 }
 return <section className={styles.root} aria-label={'Spielzeit-, Performance- und Store-Daten für '+title}>
  <div className={styles.head}>
   <div><small>GAME INTELLIGENCE / EXTERNAL SOURCES</small>
    <h4>SPIELZEIT, FPS <em>& STORE-ABGLEICH</em></h4>
    <p>Externe Daten auf Abruf. Angaben stammen aus unabhängigen Community-Quellen und werden nicht mit Sony-Spielzeit oder deutschen Store-Preisen verwechselt.</p>
   </div>
   <button type="button" onClick={load} disabled={busy||title.length<3}>
    {busy?'QUELLEN WERDEN ABGEFRAGT …':loaded?'DATEN NEU LADEN':'QUELLENDATEN ABRUFEN'}
   </button>
  </div>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  {loaded?<div className={styles.sections}>
   <article className={styles.card}>
    <div className={styles.cardHead}><strong>HOWLONGTOBEAT</strong><a href={'https://howlongtobeat.com/?q='+encodeURIComponent(title)} target="_blank" rel="noopener noreferrer">Quelle durchsuchen</a></div>
    {primary?<><p className={styles.title}>{primary.title} · Community-Zeitwerte</p>
     <div className={styles.facts}>
      <div><small>Story</small><strong>{fmt(primary.mainHours)}</strong></div>
      <div><small>Story + Extras</small><strong>{fmt(primary.extrasHours)}</strong></div>
      <div><small>100 % / Completionist</small><strong>{fmt(primary.completionistHours)}</strong></div>
      {psnMinutes!==null?<div><small>Deine kumulierte PSN-Zeit</small><strong>{fmt(Math.round(psnMinutes/6)/10)}</strong></div>:null}
     </div>
     <p className={styles.small}>HLTB-100 % ist nicht zwangsläufig eine Platinzeit. Abweichende Editionen können andere Laufzeiten haben. {Number.isInteger(primary.mainSamples)&&primary.mainSamples>0?'Story-Wert: '+primary.mainSamples+' Meldungen. ':''}</p>
     <div className={styles.actions}>
      {int(primary.mainHours)!==null?<button type="button" onClick={()=>useAsGoal(primary.mainHours,'story')}>STORY-WERT ALS ZIEL VORMERKEN</button>:null}
      {int(primary.completionistHours)!==null?<button type="button" onClick={()=>useAsGoal(primary.completionistHours,'personal')}>100%-WERT VORMERKEN</button>:null}
     </div>
    </>:<p className={styles.small}>{hltb?.status==='unavailable'?
     'HLTB konnte aus dieser Serverumgebung nicht abgefragt werden. Dies ist keine Aussage darüber, ob das Spiel dort vorhanden ist.':
     'Kein exakt passender Spieltitel mit verlässlichen Zeitwerten gefunden.'}</p>}
    <small className={styles.source}>Quelle: HowLongToBeat · Community, kein offizieller Sony-Datensatz</small>
   </article>
   <article className={styles.card}>
    <div className={styles.cardHead}><strong>FRAMEPATCH / PS5 FPS</strong><a href="https://framepatch.app" target="_blank" rel="noopener noreferrer">Quelle</a></div>
    {fps?<><p className={styles.title}>Letzter Datenabgleich: {fps.lastVerified||'unbekannt'} · kein eigener FPS-Test</p>
     {fps.entries.map(entry=><div className={styles.fpsModel} key={entry.model}>
      <h5>{entry.model} · {entry.appType} · <span>{entry.fps} FPS Zielwert</span></h5>
      <small>Beleglage: {lang[entry.confidence]||'Unbekannt'}</small>
      <div className={styles.modes}>{entry.modes.map((mode,i)=><div key={mode.name+i}>
       <b>{mode.name}</b><span>{mode.targetFps!==null?mode.targetFps+' FPS Ziel':'FPS unbekannt'}</span>
       {mode.resolution?<small>{mode.resolution}</small>:null}
       {mode.unlocked?<small>Freigeschaltete Bildrate</small>:null}
       {mode.vrr?<small>VRR</small>:null}
       {mode.note?<p>{mode.note}</p>:null}
      </div>)}</div>
     </div>)}
     {fps.patch?<p className={styles.small}>FPS-Änderung durch Patch {fps.patch.version||'ohne Versionsnummer'} ({fps.patch.date||'undatiert'}): {fps.patch.previousFps??'unbekannt'} → {fps.patch.newFps??'unbekannt'} FPS. <a href={fps.patch.url} target="_blank" rel="noopener noreferrer">Patchbeleg öffnen</a></p>:null}
     {fps.evidence?.length?<div className={styles.evidence}><strong>Quellenbelege</strong>
      {fps.evidence.slice(0,4).map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.publisher||s.title||'FPS-Nachweis'} öffnen</a>)}</div>:null}
    </>:<p className={styles.small}>Kein eindeutig zugeordneter und mit Quellen belegter PS5-/PS5-Pro-FPS-Eintrag. Daraus lässt sich weder 30 noch 60 FPS ableiten.</p>}
    <small className={styles.source}>Quelle: FramePatch. FPS sind dokumentierte Zielwerte, keine garantierte konstante Framerate. PS5-Pro-Modi nur anzeigen, wenn vorhanden.</small>
   </article>
   <article className={styles.card}>
    <div className={styles.cardHead}><strong>PLAYSTATION STORE-KATALOG</strong><a href="https://github.com/Ephellon/game-store-catalog" target="_blank" rel="noopener noreferrer">Quelle</a></div>
    <p className={styles.small}>Externer Store-Snapshot für <b>USA / USD</b>. Nicht live verifiziert, nicht der deutsche PS Store und nicht als aktuelles Kaufangebot zu verstehen. Stand: {store?.snapshotAt||'unbekannt'}.</p>
    {store?.matches?.length?<div className={styles.storeRows}>
     {store.matches.map((row,i)=><div key={row.href||i}><div>
      <strong>{row.title}</strong><small>{row.platform||'Plattform nicht bestätigt'}</small>
     </div><div><span>{row.priceLabel}</span>
      <a href={row.href} target="_blank" rel="noopener noreferrer">US-Store ansehen</a></div></div>)}
    </div>:<p className={styles.small}>Kein exakt passender US-Store-Titel im Snapshot gefunden; ein fehlender Treffer belegt keine Nichtverfügbarkeit.</p>}
   </article>
  </div>:<p className={styles.hint}>Keine automatischen externen Abfragen beim Öffnen der Spieleübersicht. Erst mit dem Button werden die drei externen Quellen geprüft.</p>}
 </section>;
}
