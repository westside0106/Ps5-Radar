'use client';
import {useEffect,useState} from 'react';
// Only foreground UX. The existing service worker intentionally does not cache private PSN data.
export default function RadarAppTools({matched=[]}){
 const [deferred,setDeferred]=useState(null),[installed,setInstalled]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  const before=e=>{e.preventDefault();setDeferred(e)};
  const ready=()=>{setInstalled(true);setDeferred(null)};
  setInstalled(window.matchMedia('(display-mode: standalone)').matches||Boolean(window.navigator.standalone));
  window.addEventListener('beforeinstallprompt',before);
  window.addEventListener('appinstalled',ready);
  return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',ready)};
 },[]);
 async function install(){
  if(!deferred){setMessage('Auf dem iPhone: Safari → Teilen → Zum Home-Bildschirm. Auf Android: Browsermenü → App installieren.');return}
  try{await deferred.prompt();const result=await deferred.userChoice;setMessage(result?.outcome==='accepted'?'Installation bestätigt.':'Installation wurde nicht ausgeführt.');setDeferred(null)}
  catch{setMessage('App-Installation ist in diesem Browser nicht verfügbar.')}
 }
 async function alertNow(){
  if(!matched.length){setMessage('Keine bestätigten aktiven Preisziele erreicht.');return}
  if(!('Notification' in window)){setMessage('Dieser Browser unterstützt keine Web-Benachrichtigungen.');return}
  try{
   const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
   if(permission!=='granted'){setMessage('Benachrichtigungsberechtigung nicht erteilt.');return}
   const names=matched.slice(0,3).map(x=>x.title+' ('+x.price.toLocaleString('de-DE',{style:'currency',currency:'EUR'})+')').join(' · ');
   const note=new Notification('PS5-Radar · Preisziel erreicht',{body:names,tag:'radar-active-price-rules'});
   note.onclick=()=>{window.focus();window.location.href='/zentrale?tab=preise'};
   setMessage('Einmaliger Browser-Hinweis für vorhandene Treffer gesendet. Keine Hintergrundüberwachung.');
  }catch{setMessage('Der Browser konnte keine Benachrichtigung anzeigen.')}
 }
 return <section className="rz-app-tools" aria-label="Radar als App und Preis-Hinweise">
  <div><span className="rz-kicker">DEIN RADAR ÜBERALL</span><h3>Radar als Homescreen-App</h3><p>Installierbar, mit Offline-Hinweisseite. Private PSN-Daten werden nicht im Service Worker zwischengespeichert. Für aktuelle Inhalte bleibt eine Verbindung erforderlich.</p></div>
  <div className="rz-app-actions">
   <button type="button" onClick={install}>{installed?'Installationshinweise':'App installieren / Anleitung'}</button>
   <button type="button" disabled={!matched.length} onClick={alertNow}>Aktuelle Preis-Treffer anzeigen ({matched.length})</button>
  </div>
  {message?<p role="status">{message}</p>:null}
  <small>Preis-Hinweise werden nur auf deinen Klick im geöffneten Browser versendet. Das ist weder Push noch eine automatische Überwachung.</small>
 </section>;
}
