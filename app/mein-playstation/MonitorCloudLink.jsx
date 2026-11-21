'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {PSN_MONITOR_KEY,PSN_MONITOR_EVENT,mergeObservedSessions,normalizeObservedSessions} from '../../lib/psn-monitor-import.mjs';
import styles from './MonitorCloudLink.module.css';

const TOGGLE='psn-monitor-auto-receive-v1';
const URL='/mein-playstation/api/monitor-sync';
const POLL_MS=120000;
function displayDate(value){
 try{return new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(value))}
 catch{return 'unbekannt'}
}
export default function MonitorCloudLink(){
 const [enabled,setEnabled]=useState(true);
 const [status,setStatus]=useState('Prüfe den Server-Abgleich …');
 const [lastAt,setLastAt]=useState(null);
 const [lastCount,setLastCount]=useState(null);
 const [working,setWorking]=useState(false);
 const busy=useRef(false);
 const mounted=useRef(true);
 const refresh=useCallback(async ()=>{
  if(busy.current)return;
  busy.current=true;
  if(mounted.current)setWorking(true);
  try{
   const response=await fetch(URL,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   if(!response.ok){
    const msg=response.status===401?'Radar-Sitzung abgelaufen. Bitte erneut anmelden.':
     response.status===503?'Server-Abgleich noch nicht eingerichtet oder nicht verfügbar.':'Server-Abgleich fehlgeschlagen (HTTP '+response.status+').';
    if(mounted.current)setStatus(msg);
    return;
   }
   const data=await response.json();
   if(!data?.configured){if(mounted.current)setStatus('Server-Abgleich noch nicht eingerichtet.');return}
   if(mounted.current){setLastAt(data.receivedAt||null);setLastCount(Array.isArray(data.sessions)?data.sessions.length:0)}
   if(!data.connected){
    if(mounted.current)setStatus('Server erreichbar – noch keine Monitor-Daten empfangen.');
    return;
   }
   const remote=normalizeObservedSessions(data.sessions);
   let local=[];
   try{local=normalizeObservedSessions(JSON.parse(localStorage.getItem(PSN_MONITOR_KEY)||'[]'))}catch{}
   const merged=mergeObservedSessions(local,remote);
   const oldIds=new Set(local.map(x=>x.id));
   const added=merged.filter(x=>!oldIds.has(x.id)).length;
   if(added>0){
    localStorage.setItem(PSN_MONITOR_KEY,JSON.stringify(merged));
    window.dispatchEvent(new Event(PSN_MONITOR_EVENT));
   }
   if(mounted.current)setStatus(added>0?added+' neue beobachtete Intervalle automatisch übernommen.':'Daten abgeglichen · keine neuen Intervalle.');
  }catch{
   if(mounted.current)setStatus('Server derzeit nicht erreichbar oder Browser-Speicher nicht verfügbar.');
  }finally{
   busy.current=false;
   if(mounted.current)setWorking(false);
  }
 },[]);
 useEffect(()=>{
  mounted.current=true;
  try{setEnabled(localStorage.getItem(TOGGLE)!=='no')}catch{}
  return()=>{mounted.current=false};
 },[]);
 useEffect(()=>{
  if(!enabled)return;
  void refresh();
  const onFocus=()=>{if(document.visibilityState==='visible')void refresh()};
  const interval=window.setInterval(onFocus,POLL_MS);
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onFocus);
  return()=>{
   window.clearInterval(interval);
   window.removeEventListener('focus',onFocus);
   document.removeEventListener('visibilitychange',onFocus);
  };
 },[enabled,refresh]);
 function changeEnabled(next){
  setEnabled(next);
  try{localStorage.setItem(TOGGLE,next?'yes':'no')}catch{}
  if(!next)setStatus('Automatischer Empfang pausiert. Manuelles Abgleichen bleibt möglich.');
 }
 return <div className={styles.root} aria-label="Automatischer Monitor-Serverabgleich">
  <div className={styles.heading}>
   <div><small>SERVER CONNECTION // SECURE PUSH</small><strong>AUTOMATISCHER DATENABGLEICH</strong></div>
   <span className={styles.indicator} aria-hidden="true"/>
  </div>
  <p>Dein Ubuntu-Server kann die Monitor-CSV über einen separaten, geheimen Zugang an PS5-Radar senden. Diese Ansicht lädt nur die bereits geprüften Sitzungsintervalle – keine CSV und keine PSN-Tokens.</p>
  <label className={styles.switch}>
   <input type="checkbox" checked={enabled} onChange={e=>changeEnabled(e.target.checked)}/>
   <span>Beim Öffnen und alle zwei Minuten automatisch abgleichen</span>
  </label>
  <div className={styles.actions}>
   <button type="button" onClick={()=>void refresh()} disabled={working}>{working?'VERBINDUNG WIRD GEPRÜFT …':'JETZT ABGLEICHEN ↗'}</button>
   {lastAt?<span>Letzte Server-Lieferung: {displayDate(lastAt)} · {lastCount} Intervalle</span>:<span>Noch keine bestätigte Server-Lieferung</span>}
  </div>
  <p className={styles.status} role="status" aria-live="polite">{status}</p>
  <small className={styles.note}>Das Abschalten stoppt das automatische Einlesen auf diesem Gerät. Bereits gespeicherte Intervalle bleiben erhalten. Bei aktivem Server-Push können lokal gelöschte Daten beim nächsten Abruf erneut erscheinen.</small>
 </div>;
}
