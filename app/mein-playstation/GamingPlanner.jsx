'use client';
import {useMemo,useState,useEffect} from 'react';
const KEY='psn-game-planner-v1';
const choices=[['planned','Geplant'],['playing','In Arbeit'],['paused','Pausiert'],['completed','Durchgespielt'],['platinum','Platin-Ziel']];
const norm=v=>String(v||'').trim().toLocaleLowerCase('de');
const getId=g=>String(g.titleId||g.name||g.titleName||'');
function mins(v){if(!v)return 0;if(typeof v==='number')return Math.max(0,v);const m=String(v).match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);return m?Number(m[1]||0)*1440+Number(m[2]||0)*60+Number(m[3]||0)+Number(m[4]||0)/60:0}
const hours=v=>Math.round(v/60).toLocaleString('de-DE');
export default function GamingPlanner({played=[],titles=[]}){
 const [notes,setNotes]=useState({});
 const [selected,setSelected]=useState('');
 const [budget,setBudget]=useState(2);
 const [filter,setFilter]=useState('all');
 useEffect(()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');if(data&&typeof data==='object'&&!Array.isArray(data))setNotes(data)}catch{}},[]);
 const games=useMemo(()=>played.filter(g=>!(/^(youtube|spotify|netflix|twitch|prime video|disney\+|apple tv)$/i.test(String(g.name||'')))).map(g=>({key:getId(g),name:g.name||g.titleName||'Spiel',game:g})).filter(g=>g.key),[played]);
 const stats=useMemo(()=>{
  const times=games.map(x=>mins(x.game.playDuration));
  const total=times.reduce((a,v)=>a+v,0);
  const tracked=games.filter(x=>notes[x.key]?.status).length;
  const trophyByName=new Map(titles.map(t=>[norm(t.trophyTitleName),Number(t.progress)||0]));
  const progress=games.map(g=>({...g,trophy:trophyByName.get(norm(g.name))??null})).filter(g=>g.trophy!==null);
  return {total,tracked,progress,completed:progress.filter(x=>x.trophy===100).length};
 },[games,notes,titles]);
 const ranked=useMemo(()=>games.filter(x=>filter==='all'||notes[x.key]?.status===filter).sort((a,b)=>(notes[b.key]?.favorite?1:0)-(notes[a.key]?.favorite?1:0)||mins(a.game.playDuration)-mins(b.game.playDuration)),[games,notes,filter]);
 const recommendation=useMemo(()=>{
  const eligible=games.filter(g=>!['completed'].includes(notes[g.key]?.status));
  const fits=eligible.filter(g=>{const estimate=g.game.communityInsight?.rushedHours;return estimate==null||estimate<=budget*6});
  return (fits.length?fits:eligible).sort((a,b)=>Number(!!notes[b.key]?.favorite)-Number(!!notes[a.key]?.favorite)||Number(b.game.lastPlayedDateTime?new Date(b.game.lastPlayedDateTime):0)-Number(a.game.lastPlayedDateTime?new Date(a.game.lastPlayedDateTime):0))[0]||null;
 },[games,notes,budget]);
 function save(id,patch){setNotes(old=>{const next={...old,[id]:{...(old[id]||{}),...patch}};try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}return next})}
 const focused=games.find(g=>g.key===selected)||null;
 const statuses=Object.fromEntries(choices.map(([key])=>[key,games.filter(g=>notes[g.key]?.status===key).length]));
 return <section className="psn-planner" aria-label="Spielplaner und Statistiken">
  <div className="psn-planner-heading"><h3>Deine Gaming-Zentrale</h3><small>Dein Backlog und Statistiken · persönliche Einträge nur in diesem Browser</small></div>
  <div className="psn-planner-stats"><div><small>Erfasste Spiele</small><strong>{games.length}</strong></div><div><small>PSN-Spielzeit</small><strong>{hours(stats.total)} Std.</strong></div><div><small>Mit Status</small><strong>{stats.tracked}</strong></div><div><small>100 % Trophäen</small><strong>{stats.completed}</strong></div></div>
  <div className="psn-planner-panels"><div className="psn-planner-box"><h4>Was spiele ich heute?</h4><label>Mein Zeitbudget <select value={budget} onChange={e=>setBudget(Number(e.target.value))}><option value="1">1 Stunde</option><option value="2">2 Stunden</option><option value="4">4 Stunden</option><option value="8">8 Stunden</option></select></label>{recommendation?<p><strong>{recommendation.name}</strong><small> Vorschlag aus deinen zuletzt gespielten Titeln; kein Live-Tracking</small></p>:<p>Keine Spiele verfügbar.</p>}</div>
  <div className="psn-planner-box"><h4>Meine Spiele planen</h4><label>Spiel auswählen<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Spiel auswählen …</option>{games.map(g=><option key={g.key} value={g.key}>{g.name}</option>)}</select></label>{focused?<><label>Status<select value={notes[selected]?.status||''} onChange={e=>save(selected,{status:e.target.value})}><option value="">Noch nicht eingestuft</option>{choices.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label className="psn-planner-check"><input type="checkbox" checked={!!notes[selected]?.favorite} onChange={e=>save(selected,{favorite:e.target.checked})}/> Favorit</label><label>Meine Notiz<textarea maxLength={800} rows={2} placeholder="Was möchte ich noch erledigen?" value={notes[selected]?.note||''} onChange={e=>save(selected,{note:e.target.value})}/></label></>:null}</div></div>
  <div className="psn-planner-box"><h4>Backlog-Übersicht</h4><div className="psn-planner-filters"><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Alle ({games.length})</button>{choices.map(([v,label])=><button key={v} type="button" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{label} ({statuses[v]})</button>)}</div><div className="psn-planner-items">{ranked.slice(0,12).map(g=><button key={g.key} type="button" onClick={()=>setSelected(g.key)}><span>{notes[g.key]?.favorite?'★ ':''}{g.name}</span><small>{choices.find(c=>c[0]===notes[g.key]?.status)?.[1]||'Offen'} · {hours(mins(g.game.playDuration))} Std.</small></button>)}</div>{ranked.length>12?<small>Die ersten 12 Spiele werden angezeigt. Über die Filter eingrenzen.</small>:null}</div>
  <p className="psn-planner-foot">Wichtig: Die PSN-Spielzeit ist kumuliert, keine Sitzungs-Historie. Trophäen-100 % bedeutet nicht automatisch Platin. Backlog und Favoriten werden nur lokal auf diesem Gerät gespeichert.</p>
 </section>;
}
