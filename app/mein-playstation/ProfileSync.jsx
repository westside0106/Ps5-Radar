'use client';
import {useEffect,useRef,useState} from 'react';

const keys={
 notes:'psn-game-planner-v1',
 history:'psn-playtime-snapshots-v1',
 covers:'psn-cover-preferences-v1',
 coverUrls:'psn-cover-urls-v1',
 trophyTargets:'psn-trophy-targets-v1',
 platinumChecks:'psn-platinum-checks-v1'
};
const defaults={notes:{},history:[],covers:{},coverUrls:{},trophyTargets:{},platinumChecks:{}};
function localSnapshot(){
 const data={};
 for(const [name,key] of Object.entries(keys)){
  try{const raw=localStorage.getItem(key);data[name]=raw===null?defaults[name]:JSON.parse(raw)}
  catch{data[name]=defaults[name]}
 }
 return data;
}
async function responseJson(response){
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error||'Cloud-Anfrage fehlgeschlagen'),{status:response.status});
 return data;
}
export default function ProfileSync(){
 const [autoSave,setAutoSave]=useState(false);
 const [revision,setRevision]=useState(null);
 const [remote,setRemote]=useState(null);
 const [remoteDate,setRemoteDate]=useState(null);
 const [message,setMessage]=useState('Cloud-Verbindung wird geprüft.');
 const [working,setWorking]=useState(false);
 const revisionRef=useRef(null),syncingRef=useRef(false),queuedRef=useRef(false);

 async function check(){
  setWorking(true);
  try{
   const data=await responseJson(await fetch('/mein-playstation/api/profile-sync',{credentials:'same-origin',cache:'no-store'}));
   if(!data.configured){revisionRef.current=null;setRevision(null);setMessage('Cloud nicht konfiguriert. Dein lokaler Spielplan bleibt nutzbar.');return}
   const next=data.record?.revision??0;
   revisionRef.current=next;setRevision(next);
   setRemote(data.record?.payload||null);setRemoteDate(data.record?.updated_at||null);
   setMessage(data.record?'Cloud-Verbindung aktiv. Profil-Version '+next+' gefunden.':'Cloud verbunden. Es gibt noch kein Backup.');
  }catch(error){setMessage('Verbindung fehlgeschlagen: '+error.message)}
  finally{setWorking(false)}
 }
 useEffect(()=>{void check();try{setAutoSave(localStorage.getItem('psn-sync-on-save-v1')==='yes')}catch{}},[]);

 async function upload(){
  if(revisionRef.current===null){setMessage('Cloud noch nicht bereit. Zuerst Verbindung prüfen.');return}
  if(syncingRef.current){queuedRef.current=true;return}
  syncingRef.current=true;setWorking(true);
  const data=localSnapshot();
  try{
   const result=await responseJson(await fetch('/mein-playstation/api/profile-sync',{
    method:'PUT',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({version:2,revision:revisionRef.current,data})
   }));
   revisionRef.current=result.revision;setRevision(result.revision);
   setRemote(data);setRemoteDate(result.updated_at||new Date().toISOString());
   setMessage('Gespeichert in der Cloud · Version '+result.revision+'. Auf weiteren Geräten „Cloud-Daten laden“ verwenden.');
  }catch(error){
   queuedRef.current=false;
   setMessage(error.status===409?'Versionskonflikt: Die Cloud hat einen anderen Stand. Bitte erst „Verbindung prüfen“; nichts wurde überschrieben.':'Cloud-Sicherung fehlgeschlagen: '+error.message);
  }finally{
   syncingRef.current=false;setWorking(false);
   if(queuedRef.current){queuedRef.current=false;queueMicrotask(()=>void upload())}
  }
 }
 useEffect(()=>{
  if(!autoSave)return;
  const onSaved=()=>void upload();
  window.addEventListener('psn-profile-local-change',onSaved);
  return()=>window.removeEventListener('psn-profile-local-change',onSaved);
 },[autoSave]);

 function restore(){
  if(!remote||!window.confirm('Cloud-Daten auf diesem Gerät übernehmen? Deine lokalen Einstellungen werden ersetzt. Erstelle bei Bedarf vorher ein JSON-Backup.'))return;
  const changes=Object.entries(keys).filter(([name])=>remote[name]!==undefined&&remote[name]!==null).map(([name,key])=>[key,JSON.stringify(remote[name])]);
  const previous=changes.map(([key])=>[key,localStorage.getItem(key)]);
  try{
   for(const [key,value] of changes)localStorage.setItem(key,value);
   window.location.reload();
  }catch{
   for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}catch{}}
   setMessage('Cloud-Daten konnten nicht vollständig lokal gespeichert werden; vorheriger Stand wurde soweit möglich wiederhergestellt.');
  }
 }
 return <div className="psn-planner-box psn-profile-sync">
  <h4>Meine Daten auf anderen Geräten</h4>
  <p>Deine persönlichen Spielpläne, Favoriten, Trophäenziele und Cover-Einstellungen liegen zunächst im Browser. Hier kannst du sie sichern und auf ein anderes Gerät übertragen. PSN-Trophäen werden unabhängig davon abgerufen.</p>
  {remoteDate?<small>Letztes Cloud-Backup: {new Date(remoteDate).toLocaleString('de-DE')} · Version {revision}</small>:null}
  <p role="status" aria-live="polite">{message}</p>
  <label className="psn-planner-check"><input type="checkbox" checked={autoSave} onChange={e=>{setAutoSave(e.target.checked);try{localStorage.setItem('psn-sync-on-save-v1',e.target.checked?'yes':'no')}catch{}}}/> Nach dem bewussten Speichern eines Spielplans automatisch sichern</label>
  <div className="psn-planner-filters">
   <button type="button" disabled={working} onClick={check}>Verbindung prüfen</button>
   <button type="button" disabled={working||revision===null} onClick={()=>void upload()}>In Cloud speichern</button>
   <button type="button" disabled={working||!remote} onClick={restore}>Cloud-Daten laden</button>
  </div>
  <small>Automatik ist optional und lädt niemals selbständig Daten zurück. Bei widersprüchlichen Versionen wird nichts überschrieben.</small>
 </div>;
}
