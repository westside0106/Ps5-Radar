'use client';
import {useEffect,useMemo,useState} from 'react';
import {normalizeCollections,normalizeManualGames} from '../../lib/psn-game-collections.mjs';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
export default function MuseumClient(){
 const [games,setGames]=useState([]),[collections,setCollections]=useState([]),[notes,setNotes]=useState({}),[coverUrls,setCoverUrls]=useState({});
 const [collectionId,setCollectionId]=useState(''),[query,setQuery]=useState(''),[style,setStyle]=useState('wall');
 useEffect(()=>{
  const update=()=>{
   const played=read('psn-museum-library-v1',[]);
   const manual=normalizeManualGames(read('psn-custom-games-v1',[])).map(g=>({id:g.titleId,name:g.name,cover:null,isManual:true}));
   const all=new Map((Array.isArray(played)?played:[]).filter(g=>g&&g.id&&g.name).map(g=>[g.id,g]));
   for(const game of manual)if(!all.has(game.id))all.set(game.id,game);
   setGames([...all.values()].slice(0,1800));
   setCollections(normalizeCollections(read('psn-game-collections-v1',[])));
   setNotes(read('psn-game-planner-v1',{}));
   setCoverUrls(read('psn-cover-urls-v1',{}));
  };
  update();
  for(const event of ['storage','psn-museum-update','psn-profile-local-change'])window.addEventListener(event,update);
  return()=>{for(const event of ['storage','psn-museum-update','psn-profile-local-change'])window.removeEventListener(event,update)};
 },[]);
 const current=collections.find(x=>x.id===collectionId);
 const visible=useMemo(()=>games.filter(g=>(!current||current.gameIds.includes(g.id))&&g.name.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))).sort((a,b)=>Number(!!notes[b.id]?.favorite)-Number(!!notes[a.id]?.favorite)||a.name.localeCompare(b.name,'de')),[games,current,query,notes]);
 const goals=games.filter(g=>notes[g.id]?.status==='platinum').length;
 const favorites=games.filter(g=>notes[g.id]?.favorite).length;
 return <main className="exp-shell"><section className="exp-page"><header className="exp-cover exp-cover-museum">
  <span className="exp-kicker">RADAR · PERSÖNLICHE SAMMLUNG</span><h1>Dein Sammlungs-Museum</h1><p>Ein virtueller Ausstellungsraum für deine Spiele und selbst angelegten Kollektionen. Deine PSN-Bibliothek wird auf diesem Gerät angezeigt, nachdem du die Spielewelt geöffnet hast.</p>
  <div className="exp-metrics"><span><strong>{games.length}</strong> Titel erfasst</span><span><strong>{collections.length}</strong> Sammlungen</span><span><strong>{favorites}</strong> Favoriten</span><span><strong>{goals}</strong> Platin-Ziele</span></div></header>
  <div className="exp-toolbar"><label>Sammlung<select value={collectionId} onChange={e=>setCollectionId(e.target.value)}><option value="">Gesamte Ausstellung</option>{collections.map(c=><option key={c.id} value={c.id}>{c.name} ({c.gameIds.length})</option>)}</select></label><label>In der Ausstellung suchen<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Spiel suchen …" type="search"/></label><div className="exp-switch" role="group" aria-label="Galerieansicht"><button aria-pressed={style==='wall'} onClick={()=>setStyle('wall')}>Galeriewand</button><button aria-pressed={style==='shelf'} onClick={()=>setStyle('shelf')}>Regal</button></div></div>
  {current?<h2>{current.name} <small>{visible.length} Exponate</small></h2>:<h2>Die Ausstellung <small>{visible.length} Exponate</small></h2>}
  <div className={'exp-museum-grid exp-museum-'+style}>{visible.slice(0,360).map(g=><article key={g.id} className="exp-exhibit">
   <div className="exp-art">{(coverUrls[g.id]||g.cover)?<img src={coverUrls[g.id]||g.cover} alt="" loading="lazy" decoding="async" onError={e=>e.currentTarget.style.visibility='hidden'}/>:<span aria-hidden="true">GAME</span>}{notes[g.id]?.favorite?<b className="exp-favorite" aria-label="Favorit">★</b>:null}</div>
   <div className="exp-exhibit-caption"><strong>{g.name}</strong><small>{g.isManual?'Manuell vorgemerkt':notes[g.id]?.status==='platinum'?'Platin-Projekt':notes[g.id]?.status?'Status: '+notes[g.id].status:'PSN-Spielverlauf'}</small></div>
  </article>)}</div>
  {visible.length>360?<p className="exp-footnote">Die ersten 360 Exponate werden angezeigt. Mit der Suche oder den Sammlungen kannst du die Auswahl eingrenzen.</p>:null}
  {!games.length?<div className="exp-empty"><h3>Deine Galerie ist noch leer</h3><p>Öffne „Meine Spielwelt“, damit die bekannten PSN-Titel und Cover lokal übernommen werden. Manuelle Titel erscheinen automatisch.</p><a href="/mein-playstation?view=games">Spielwelt öffnen</a></div>:null}
  {games.length&&!visible.length?<p className="exp-empty">Für diesen Filter keine Exponate gefunden.</p>:null}
  <footer className="exp-footer"><a href="/mein-playstation?view=games">Sammlungen bearbeiten</a><a href="/magazin">Persönliches Magazin</a><a href="/zentrale">Radar-Zentrale</a></footer>
  <p className="exp-footnote">Diese Ausstellung ist eine lokale Momentaufnahme des bekannten PSN-Spielverlaufs, kein Eigentumsnachweis. Einträge aus der digitalen Kaufbibliothek können fehlen.</p>
 </section></main>;
}