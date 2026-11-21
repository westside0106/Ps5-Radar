'use client';
import {useEffect,useState} from 'react';
import styles from './NtfyPushPanel.module.css';

export default function NtfyPushPanel(){
 const [status,setStatus]=useState(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  (async()=>{
   try{
    const response=await fetch('/zentrale/api/ntfy',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('Push-Konfiguration derzeit nicht lesbar');
    const data=await response.json();
    if(!controller.signal.aborted)setStatus(data);
   }catch(e){if(!controller.signal.aborted)setError(e.message||'Abfrage fehlgeschlagen')}
   finally{if(!controller.signal.aborted)setLoading(false)}
  })();
  return()=>controller.abort();
 },[]);
 async function copyTopic(){
  if(!status?.topic)return;
  setError('');
  try{await navigator.clipboard.writeText(status.topic);setMessage('Topic in die Zwischenablage kopiert.')}
  catch{setError('Kopieren nicht erlaubt. Topic unten manuell auswählen.')}
 }
 async function sendTest(){
  setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/zentrale/api/ntfy',{method:'POST',credentials:'same-origin',cache:'no-store'});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'Testversand fehlgeschlagen');
   setMessage('ntfy hat den Test angenommen. Prüfe, ob die Meldung auf deinem iPhone angekommen ist.');
  }catch(e){setError(e.message||'Testversand fehlgeschlagen')}
  finally{setBusy(false)}
 }
 return <section className={styles.root} aria-label="ntfy Push-Benachrichtigungen">
  <header className={styles.header}><div><span className={styles.kicker}>DELIVERY CHANNEL / iPHONE</span><h2>NTFY-<em>PUSH</em></h2>
   <p>Störungen und Wiederherstellungen aus deiner privaten Quellenhistorie können automatisch als iOS-Mitteilung ankommen.</p></div>
   <span className={styles.state} data-ready={Boolean(status?.configured)}>{loading?'PRÜFE …':status?.configured?'SERVER VERBUNDEN':'NICHT EINGERICHTET'}</span>
  </header>
  {status?.configured?<div className={styles.setup}>
   <div><strong>1 · Auf deinem iPhone</strong><p>Die <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer">ntfy-App</a> installieren, Server <code>{status.server}</code> auswählen und das folgende Topic abonnieren.</p>
    <div className={styles.topic}><code>{status.topic}</code><button type="button" onClick={copyTopic}>TOPIC KOPIEREN</button></div>
   </div>
   <div><strong>2 · Zustellung prüfen</strong><p>Nach dem Abonnieren einen Test senden. Der Server nimmt die Nachricht an; ob iOS sie tatsächlich anzeigt, musst du am Gerät prüfen.</p>
    <button type="button" disabled={busy} onClick={()=>void sendTest()}>{busy?'TEST WIRD GESENDET …':'TEST-PUSH SENDEN'}</button><small>Maximal ein Test pro zehn Minuten. Nur allgemeine Quelleninformationen, keine PSN- oder Kontodaten.</small>
   </div>
  </div>:!loading?<p className={styles.disabled}>Für den Versand fehlt die serverseitige ntfy-Konfiguration. Die private Quellenhistorie und der Posteingang funktionieren weiter.</p>:null}
  {message?<p className={styles.ok} role="status">{message}</p>:null}
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  <p className={styles.foot}>Sicherheit: Auf ntfy.sh sind Topics öffentlich lesbar und beschreibbar. Der zufällige Topic-Name erschwert das Erraten, ersetzt aber keine echte Zugangskontrolle. Keine persönlichen Daten werden gepusht. Für höhere Vertraulichkeit ist ein ntfy-Server mit ACL und Authentifizierung sinnvoll. Bei Netzwerkabbrüchen kann eine Mitteilung vereinzelt doppelt ankommen.</p>
 </section>;
}
