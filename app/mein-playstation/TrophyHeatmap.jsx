'use client';
import {useEffect,useMemo,useState} from 'react';
import {TROPHY_DATES_KEY,TROPHY_DATES_EVENT,normalizeTrophyDates,trophyHeatmap} from '../../lib/psn-trophy-heatmap.mjs';

const fmt=date=>new Date(date+'T12:00:00Z').toLocaleDateString('de-DE',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
export default function TrophyHeatmap(){
 const [entries,setEntries]=useState([]);
 const [today,setToday]=useState(null);
 const [days,setDays]=useState(182);
 const [detail,setDetail]=useState('');
 useEffect(()=>{
  const reload=()=>{
   try{setEntries(normalizeTrophyDates(JSON.parse(localStorage.getItem(TROPHY_DATES_KEY)||'[]')))}catch{setEntries([])}
  };
  reload();setToday(new Date());
  window.addEventListener(TROPHY_DATES_EVENT,reload);window.addEventListener('storage',reload);
  return()=>{window.removeEventListener(TROPHY_DATES_EVENT,reload);window.removeEventListener('storage',reload)};
 },[]);
 const result=useMemo(()=>today?trophyHeatmap(entries,{days,now:today}):null,[entries,days,today]);
 const peak=Math.max(1,...(result?.grid||[]).map(d=>d.count));
 return <section className="psn-earned-heatmap" aria-label="Trophäen-Heatmap">
  <div className="psn-earned-head"><div><span className="psn-eyebrow">ECHTE PSN-FREISCHALTUNGEN</span><h3>Deine Trophäen-Heatmap</h3><p>Freischaltdaten aus bereits geöffneten PSN-Trophäenlisten. Die Übersicht ist unvollständig, solange nicht alle Spiele einzeln geladen wurden.</p></div>
   <div role="group" className="psn-earned-ranges" aria-label="Zeitraum">{[[91,'3 Mon.'],[182,'6 Mon.'],[364,'12 Mon.']].map(([n,label])=><button type="button" aria-pressed={days===n} key={n} onClick={()=>{setDays(n);setDetail('')}}>{label}</button>)}</div>
  </div>
  <div className="psn-earned-metrics"><div><strong>{result?.total??'—'}</strong><span>Erfasste Freischaltungen im Zeitraum</span></div><div><strong>{result?.observed??'—'}</strong><span>Freischaltungen insgesamt lokal erfasst</span></div><div><strong>{new Set(entries.map(e=>e.set)).size}</strong><span>Ausgewertete PSN-Trophäenlisten</span></div></div>
  <div className="psn-earned-grid-frame">
   {result?<div className="psn-earned-grid" role="group" aria-label="Tägliche Freischaltungen">
    {result.grid.map(d=><button type="button" key={d.date} onClick={()=>setDetail(d.date)} title={fmt(d.date)+': '+d.count+' Trophäen'} aria-label={fmt(d.date)+': '+d.count+' Trophäen'} aria-pressed={detail===d.date} className={'psn-earned-day '+(d.count?'psn-earned-level-'+Math.min(4,Math.max(1,Math.ceil(d.count/peak*4))):'')} />)}
   </div>:<p className="psn-muted">Heatmap wird vorbereitet …</p>}
  </div>
  {detail&&result?<p role="status" className="psn-earned-selected">{fmt(detail)}: {result.grid.find(d=>d.date===detail)?.count||0} lokal erfasste Trophäen</p>:null}
  <p className="psn-earned-note">Nur durch Sony gemeldete Einzel-Trophäen mit gültigem Freischaltzeitpunkt. Keine erfundenen Sitzungen oder Trophäen-Tageszahlen. Die Zählung wächst beim Öffnen weiterer Trophäenlisten. Lokal gespeichert, nicht automatisch cloud-synchronisiert.</p>
 </section>;
}
