'use client';
import {useEffect,useMemo,useState} from 'react';
import {normalizeSnapshotHistory,snapshotMonths} from '../../lib/psn-gaming-insights.mjs';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
export default function MagazineClient({bulletin}){
 const [notes,setNotes]=useState({}),[games,setGames]=useState([]),[history,setHistory]=useState([]),[watchlist,setWatchlist]=useState([]),[month,setMonth]=useState(new Date().toISOString().slice(0,7));
 useEffect(()=>{
  const update=()=>{
   setNotes(read('psn-game-planner-v1',{}));
   const psn=read('psn-museum-library-v1',[]);
   const manual=read('psn-custom-games-v1',[]);
   setGames([...((Array.isArray(psn)?psn:[])),...((Array.isArray(manual)?manual:[]).map(g=>({id:g.titleId,name:g.name,isManual:true})))]);
   setHistory(normalizeSnapshotHistory(read('psn-playtime-snapshots-v1',[])));
   const w=read('psradar_watchlist_v1',[]);
   setWatchlist(Array.isArray(w)?w.map(x=>typeof x==='string'?{title:x}:x):[]);
  };
  update();window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update);
 },[]);
 const titleById=useMemo(()=>new Map(games.map(g=>[g.id,g.name])),[games]);
 const plans=Object.entries(notes).filter(([id,n])=>n&&typeof n==='object'&&n.status).map(([id,n])=>({id,name:titleById.get(id)||id,...n}));
 const changed=plans.filter(g=>typeof g.updatedAt==='string'&&g.updatedAt.slice(0,7)===month);
 const platinum=plans.filter(g=>g.status==='platinum');
 const favorite=plans.filter(g=>g.favorite);
 const summary=snapshotMonths(history,12).find(m=>m.month===month);
 const monthLabel=new Date(month+'-15T12:00:00Z').toLocaleDateString('de-DE',{month:'long',year:'numeric'});
 const months=Array.from({length:12},(_,i)=>{const d=new Date();d.setUTCDate(15);d.setUTCMonth(d.getUTCMonth()-i);return d.toISOString().slice(0,7)});
 return <main className="exp-shell"><section className="exp-page exp-magazine">
  <div className="exp-print-toolbar"><label>Ausgabe wählen<select value={month} onChange={e=>setMonth(e.target.value)}>{months.map(m=><option key={m} value={m}>{new Date(m+'-15T12:00:00Z').toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</option>)}</select></label><button onClick={()=>window.print()}>Als PDF drucken / speichern</button><a href="/zentrale">Zur Zentrale</a></div>
  <header className="exp-magazine-cover"><div className="exp-magazine-photo">{bulletin.image?<img src={bulletin.image} alt=""/>:null}</div><div className="exp-magazine-overlay"><span>RADAR · PERSONAL EDITION</span><h1>MY GAMING<br/>STORY</h1><p>{monthLabel}</p><strong>{platinum.length} Platin-Ziele · {favorite.length} Favoriten · {watchlist.length} gemerkte Spiele</strong></div></header>
  <div className="exp-magazine-columns"><section className="exp-editorial"><span className="exp-kicker">DEIN MONAT</span><h2>Dein persönlicher Rückblick</h2>
   <p>Diese Ausgabe verwendet ausschließlich Daten, die auf diesem Gerät gespeichert sind. PSN-Spielzeiten sind kumulierte Messwerte, keine vollständige Sitzungs-Historie.</p>
   <div className="exp-magazine-stats"><div><strong>{changed.length}</strong><small>In diesem Monat bearbeitete Pläne</small></div><div><strong>{platinum.length}</strong><small>Aktuelle Platin-Ziele</small></div><div><strong>{summary?summary.readings:0}</strong><small>Spielzeit-Messpunkte</small></div></div>
   {summary?<p>Die Spielzeit-Chronik enthält {summary.validPairs} vergleichbare Messpaare. Eine Differenz von {(summary.indicativeMinutes/60).toLocaleString('de-DE',{maximumFractionDigits:1})} Stunden ist ein Indikator zwischen kumulierten PSN-Werten, keine nachgewiesene Monats-Spielzeit.</p>:<p>Für diesen Monat liegen noch keine vergleichbaren lokalen Messpunkte vor.</p>}
  </section>
  <section className="exp-editorial"><span className="exp-kicker">DEINE MISSIONEN</span><h2>Platin & Ziele</h2>
   {platinum.length?<ol>{platinum.slice(0,7).map(g=><li key={g.id}><strong>{g.name}</strong>{g.note?<p>{g.note}</p>:null}</li>)}</ol>:<p>Noch keine persönlichen Platin-Ziele gespeichert.</p>}
  </section>
  <section className="exp-editorial"><span className="exp-kicker">SAMMLUNG</span><h2>Deine Favoriten</h2>
   {favorite.length?<ul>{favorite.slice(0,10).map(g=><li key={g.id}>{g.name}</li>)}</ul>:<p>Markiere Spiele in deiner Spielwelt als Favorit, um sie hier zu sehen.</p>}
  </section>
  <section className="exp-editorial"><span className="exp-kicker">WUNSCHLISTE</span><h2>Spiele im Blick</h2>
   {watchlist.length?<ul>{watchlist.slice(0,10).map((x,i)=><li key={i}>{x.title}</li>)}</ul>:<p>In deiner Radar-Watchlist liegen derzeit keine gemerkten Spiele.</p>}
   <h3>Aktuelles Gaming-Magazin</h3><p>{bulletin.title||'Keine aktuelle Titelmeldung'} · {bulletin.edition}</p>
  </section></div>
  <footer className="exp-footer"><a href="/museum">Sammlungs-Museum</a><a href="/mein-playstation?view=games">Spielwelt</a></footer>
  <p className="exp-footnote">PDF-Export erfolgt über die Druckfunktion deines Browsers („Als PDF sichern“). Es werden keine vollständigen Artikel, Spieltage oder Erfolge erfunden.</p>
 </section></main>;
}