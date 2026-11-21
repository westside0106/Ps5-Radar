'use client';
import {useEffect,useMemo,useState} from 'react';
import {TROPHY_GUIDES_KEY,TROPHY_GUIDES_EVENT,normalizeTrophyGuides,normalizeGuideRecord,trustedGuideUrl,trophyGuideSearches} from '../../lib/psn-trophy-guide-links.mjs';
import styles from './TrophyGuideHub.module.css';
import TrophyGuideIndexPanel from './TrophyGuideIndexPanel';

const empty={url:'',note:'',missable:'unknown',updatedAt:null};
const missableLabels={unknown:'Nicht geprüft',yes:'Ja, verpassbar',no:'Nein, nicht verpassbar'};
function sourceLabel(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return 'Externer Guide'}}
export default function TrophyGuideHub({game}){
 const trophySet=String(game?.npCommunicationId||'');
 const name=String(game?.trophyTitleName||'').trim();
 const searches=useMemo(()=>trophyGuideSearches(name),[name]);
 const [record,setRecord]=useState(empty);
 const [message,setMessage]=useState('');
 const [editing,setEditing]=useState(false);
 useEffect(()=>{
  const refresh=()=>{try{const data=normalizeTrophyGuides(JSON.parse(localStorage.getItem(TROPHY_GUIDES_KEY)||'{}'));setRecord(data[trophySet]||empty)}catch{setRecord(empty)}};
  refresh();setEditing(false);setMessage('');
  window.addEventListener('storage',refresh);
  window.addEventListener(TROPHY_GUIDES_EVENT,refresh);
  return()=>{window.removeEventListener('storage',refresh);window.removeEventListener(TROPHY_GUIDES_EVENT,refresh)};
 },[trophySet]);
 const saved=Boolean(record.updatedAt);
 const [draft,setDraft]=useState(empty);
 useEffect(()=>setDraft(record),[record]);
 function store(next){
  if(!trophySet||!name)return;
  try{
   const current=normalizeTrophyGuides(JSON.parse(localStorage.getItem(TROPHY_GUIDES_KEY)||'{}'));
   if(next)current[trophySet]=next;else delete current[trophySet];
   localStorage.setItem(TROPHY_GUIDES_KEY,JSON.stringify(current));
   window.dispatchEvent(new Event(TROPHY_GUIDES_EVENT));
   window.dispatchEvent(new Event('psn-profile-local-change'));
   setMessage(next?'Guide-Eintrag gespeichert.':'Guide-Eintrag entfernt.');
   setEditing(false);
  }catch{setMessage('Speichern nicht möglich. Browser-Speicher prüfen.')}
 }
 function save(){
  if(draft.url.trim()&&!trustedGuideUrl(draft.url)){setMessage('Nur HTTPS-Links zu PSNProfiles, PowerPyx, TrueTrophies, PlayStationTrophies oder YouTube sind erlaubt.');return}
  const value=normalizeGuideRecord({...draft,updatedAt:new Date().toISOString()});
  if(!value){setMessage('Bitte einen Guide-Link, eine Notiz oder die Verpassbarkeitsbewertung angeben.');return}
  store(value);
 }
 function chooseIndexedGuide(guide){
  const url=trustedGuideUrl(guide?.url);
  if(!url){setMessage('Guide-Link nicht als vertrauenswürdige Quelle bestätigt.');return}
  setDraft(previous=>({...previous,url}));
  setEditing(true);
  setMessage('Index-Link vorgemerkt. Prüfe vor dem Speichern Spiel, Edition und Region. Der Link ist noch nicht gespeichert.');
 }
 function remove(){
  if(!window.confirm('Gespeicherten Guide-Link, Notiz und die Bewertung dieses Trophäen-Sets entfernen?'))return;
  store(null);
 }
 return <section className={styles.root} aria-label={'Trophy Guide Hub für '+name}>
   <header className={styles.head}>
    <div className={styles.headline}>
     <span className={styles.kicker}>TROPHY INTELLIGENCE <i aria-hidden="true"> // GUIDE OPS</i></span>
     <h4>DEINE PLATIN-<em>ROADMAP.</em></h4>
     <p>Guide-Recherche und persönliche Planung, direkt mit dieser PSN-Trophäenliste verknüpft. Externe Hinweise werden nicht als geprüft ausgegeben, solange du sie nicht selbst bestätigst.</p>
    </div>
    <span className={styles.hex} aria-hidden="true">✦</span>
   </header>
   <div className={styles.searches} aria-label="Externe Trophy-Guides suchen">
    {searches.map((item,i)=><a key={item.name} href={item.url} rel="noopener noreferrer" target="_blank" className={styles.search}>
      <span className={styles.searchNum}>0{i+1}</span><strong>{item.name}</strong><small>Guide-Suche ↗</small>
    </a>)}
   </div>
   <TrophyGuideIndexPanel title={name} onChoose={chooseIndexedGuide}/>
   {saved&&!editing?<div className={styles.saved}>
      <div className={styles.savedLeft}><small>DEINE GESPEICHERTE QUELLE</small><strong>{record.url?sourceLabel(record.url):'Persönlicher Hinweis'}</strong>
        <span>Verpassbar: {missableLabels[record.missable]}</span>
        {record.note?<p>{record.note}</p>:null}
      </div>
      <div className={styles.savedActions}>{record.url?<a href={record.url} target="_blank" rel="noopener noreferrer">GUIDE ÖFFNEN ↗</a>:null}
       <button type="button" onClick={()=>{setDraft(record);setEditing(true);setMessage('')}}>Bearbeiten</button>
       <button type="button" onClick={remove}>Entfernen</button>
      </div>
    </div>:<div className={styles.editor}>
      <div className={styles.editorTitle}><strong>DEIN GUIDE-LOG</strong><small>PSN-Set {trophySet}</small></div>
      <label>Bestätigten Guide-Link speichern
       <input inputMode="url" type="url" value={draft.url||''} maxLength={600} placeholder="https://www.powerpyx.com/..." onChange={e=>setDraft(d=>({...d,url:e.target.value}))}/>
      </label>
      <label>Verpassbare Trophäen?
       <select value={draft.missable||'unknown'} onChange={e=>setDraft(d=>({...d,missable:e.target.value}))}>
        <option value="unknown">Noch nicht geprüft</option><option value="yes">Ja – Achtung, verpassbar</option><option value="no">Nein – nicht verpassbar</option>
       </select>
      </label>
      <label>Persönlicher nächster Schritt
       <textarea value={draft.note||''} maxLength={400} rows={2} placeholder="Zum Beispiel: Vor Mission X einen manuellen Spielstand anlegen …" onChange={e=>setDraft(d=>({...d,note:e.target.value}))}/>
      </label>
      <div className={styles.actions}><button type="button" className={styles.save} onClick={save}>GUIDE-LOG SPEICHERN ↗</button>{saved?<button type="button" onClick={()=>{setEditing(false);setDraft(record);setMessage('')}}>Abbrechen</button>:null}</div>
      <p className={styles.note}>Speicherung zunächst lokal. Bei aktiviertem PS5-Radar-Cloud-Backup werden diese Notizen ebenfalls gesichert. Externe Webseiten erhalten Daten nur, wenn du ihren Link öffnest.</p>
    </div>}
   {message?<p className={styles.message} role="status">{message}</p>:null}
   <div className={styles.footer}><span>QUELLE: PERSÖNLICHER GUIDE-EINTRAG</span><span>SONY TROPHY SET · {trophySet}</span></div>
  </section>;
}
