'use client';
import {useEffect,useMemo,useState} from 'react';
import {trophySetCandidates,trophyId,baseTrophy,platinumSummary} from '../../lib/psn-platinum-plan.mjs';
import {recordEarnedTrophies} from '../../lib/psn-trophy-activity.mjs';

const asIds=value=>Array.isArray(value)?value.filter(v=>typeof v==='string'&&v.length<100).slice(0,300):[];
function storedGoals(setId){
 const read=key=>{try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v[setId]:null}catch{return null}};
 return {setId,targetIds:asIds(read('psn-trophy-targets-v1')),doneIds:asIds(read('psn-platinum-checks-v1'))};
}
export function initialTrophyGoals(game,titles,saved={}){
 const candidates=trophySetCandidates(game,titles);
 const preferred=String(saved?.trophySetId||'');
 const setId=candidates.some(t=>String(t.npCommunicationId)===preferred)?preferred:candidates.length===1?String(candidates[0].npCommunicationId):'';
 return setId?storedGoals(setId):{setId:'',targetIds:[],doneIds:[]};
}
export default function PlatinumTrophyGoals({game,titles=[],goal,onChange,onDirty}){
 const candidates=useMemo(()=>trophySetCandidates(game,titles),[game,titles]);
 const [data,setData]=useState(null),[state,setState]=useState('idle'),[error,setError]=useState('');
 const [view,setView]=useState('open'),[showHidden,setShowHidden]=useState(false),[refresh,setRefresh]=useState(0);
 const [visibleCount,setVisibleCount]=useState(16);
 useEffect(()=>setVisibleCount(16),[view,goal.setId]);
 const selectedSet=candidates.find(t=>String(t.npCommunicationId)===goal.setId);
 useEffect(()=>{
  if(!selectedSet){setData(null);setState('idle');setError('');return}
  const controller=new AbortController();setData(null);setState('loading');setError('');
  const params=new URLSearchParams({id:String(selectedSet.npCommunicationId),service:selectedSet.npServiceName||'trophy',...(refresh>0?{fresh:'1'}:{})});
  fetch('/mein-playstation/api/trophies?'+params,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{const json=await response.json();if(!response.ok)throw Error(json.error||'Sony-Trophäen konnten nicht geladen werden');return json})
   .then(json=>{if(!controller.signal.aborted){setData(Array.isArray(json.trophies)?json.trophies:[]);recordEarnedTrophies(String(selectedSet.npCommunicationId),json.trophies||[]);setState('ready')}})
   .catch(e=>{if(!controller.signal.aborted){setState('error');setError(e.message)}})
  return()=>controller.abort();
 },[selectedSet?.npCommunicationId,selectedSet?.npServiceName,refresh]);
 const summary=useMemo(()=>platinumSummary(data,goal.targetIds,goal.doneIds),[data,goal.targetIds,goal.doneIds]);
 const shown=useMemo(()=>{
  if(!data)return [];
  const targets=new Set(goal.targetIds);
  return data.filter(t=>t.trophyType!=='platinum'&&(
   view==='selected'?targets.has(trophyId(t)):
   view==='all'?true:t.earned!==true
  )).sort((a,b)=>Number(baseTrophy(b))-Number(baseTrophy(a)));
 },[data,view,goal.targetIds]);
 const update=patch=>{onChange({...goal,...patch});onDirty()};
 const chooseSet=id=>{update(id?storedGoals(id):{setId:'',targetIds:[],doneIds:[]});setView('open')};
 const toggleTarget=id=>{
  const has=goal.targetIds.includes(id);
  update({targetIds:has?goal.targetIds.filter(v=>v!==id):[...goal.targetIds,id],
   doneIds:has?goal.doneIds.filter(v=>v!==id):goal.doneIds});
 };
 const toggleDone=id=>update({doneIds:goal.doneIds.includes(id)?goal.doneIds.filter(v=>v!==id):[...goal.doneIds,id]});
 return <section className="psn-platinum-plan" aria-label="Platin-Teilziele">
  <div className="psn-platinum-head"><div><h5>Meine Trophäen-Ziele</h5><small>Echte PSN-Trophäen mit deinen eigenen Arbeitsschritten verknüpfen</small></div></div>
  {!candidates.length?<p className="psn-platinum-note">Für diesen Titel konnte keine eindeutig passende Trophäenliste zugeordnet werden. Deine Notiz und dein Platin-Ziel lassen sich trotzdem speichern.</p>:<>
   <label>Trophäenliste
    <select value={goal.setId||''} onChange={e=>chooseSet(e.target.value)}>
     <option value="">Trophäenliste auswählen …</option>
     {candidates.map(t=><option key={t.npCommunicationId} value={t.npCommunicationId}>{t.trophyTitleName} · {Array.isArray(t.trophyTitlePlatform)?t.trophyTitlePlatform.join(' / '):t.trophyTitlePlatform||'PSN'} · {t.progress??0}%</option>)}
    </select>
   </label>
   {candidates.length>1?<small className="psn-platinum-note">Mehrere Fassungen gefunden. Wähle die richtige PS4-/PS5-Trophäenliste; sie werden nicht zusammengezählt.</small>:null}
   {state==='loading'?<p role="status">Offene Trophäen werden aus deinem PSN-Profil geladen …</p>:null}
   {state==='error'?<p role="alert">Trophäen nicht erreichbar: {error} <button type="button" onClick={()=>setRefresh(x=>x+1)}>Erneut prüfen</button></p>:null}
   {state==='ready'&&data?<>
    <div className="psn-platinum-metrics">
     <div><strong>{summary.baseEarned}/{summary.baseTotal}</strong><small>Basisspiel-Trophäen erhalten (ohne Platin)</small></div>
     <div><strong>{summary.remainingBase}</strong><small>Basisspiel-Trophäen noch offen</small></div>
     <div><strong>{summary.targetsPsnEarned+summary.targetsManualDone}/{summary.targetsTotal}</strong><small>Eigene Teilziele erledigt / auf PSN erhalten</small></div>
    </div>
    <div className="psn-platinum-bar" role="progressbar" aria-label="Basisspiel-Trophäen auf PSN erhalten" aria-valuemin={0} aria-valuemax={summary.baseTotal||1} aria-valuenow={summary.baseEarned}><span style={{width:(summary.baseTotal?summary.baseEarned/summary.baseTotal*100:0)+'%'}}/></div>
    <p className="psn-platinum-note">PSN ist maßgeblich für erhaltene Trophäen. Eigene Häkchen bedeuten nur „für mich erledigt“ und schalten keine PSN-Trophäe frei. DLC-Trophäen sind separat markiert.</p>
    <div className="psn-platinum-controls">
     <div role="group" aria-label="Trophäen anzeigen">
      {[[ 'open','Noch offen'],['selected','Meine Ziele'],['all','Alle']].map(([id,label])=><button key={id} type="button" aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}
     </div>
     <button type="button" onClick={()=>setRefresh(n=>n+1)}>Trophäen neu laden</button>
    </div>
    {shown.length?<><div className="psn-platinum-list">{shown.slice(0,visibleCount).map(t=>{
     const id=trophyId(t),isTarget=goal.targetIds.includes(id),manual=goal.doneIds.includes(id),hidden=t.trophyHidden&&!t.earned&&!showHidden;
     return <article key={id} className={'psn-platinum-item '+(t.earned?'is-earned':'')}>
      <div className="psn-platinum-item-title"><strong>{hidden?'Versteckte Trophäe':t.trophyName||'Unbenannte Trophäe'}</strong><small>{baseTrophy(t)?'Basisspiel':'DLC / Zusatzgruppe'} · {t.trophyType||'Trophäe'} · {t.earned?'Auf PSN erhalten':'Auf PSN offen'}</small></div>
      {!hidden&&t.trophyDetail?<p>{t.trophyDetail}</p>:null}
      <div className="psn-platinum-actions">
       <label><input type="checkbox" checked={isTarget} onChange={()=>toggleTarget(id)}/> Als Teilziel merken</label>
       {isTarget&&!t.earned?<label><input type="checkbox" checked={manual} onChange={()=>toggleDone(id)}/> Eigener Schritt erledigt</label>:null}
       {t.earned?<small>PSN bestätigt</small>:null}
      </div>
     </article>;
    })}</div>{shown.length>visibleCount?<button className="psn-platinum-more" type="button" onClick={()=>setVisibleCount(n=>n+16)}>Weitere Trophäen anzeigen ({shown.length-visibleCount} übrig)</button>:null}</>:<p className="psn-platinum-note">{view==='selected'?'Noch keine Teilziele ausgewählt. Öffne „Noch offen“ und markiere die gewünschten Trophäen.':'Keine Trophäen für diese Ansicht.'}</p>}
    {data.some(t=>t.trophyHidden&&!t.earned)?<label className="psn-platinum-check"><input type="checkbox" checked={showHidden} onChange={e=>setShowHidden(e.target.checked)}/> Versteckte Namen und Beschreibungen anzeigen</label>:null}
    <p className="psn-platinum-note"><strong>Speichern:</strong> Deine gewählten Trophäen und Häkchen werden zusammen mit dem Spielplan über den Button „Spielplan speichern“ übernommen.</p>
   </>:null}
  </>}
 </section>;
}
