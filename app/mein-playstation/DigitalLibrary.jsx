'use client';
import {useState,useMemo} from 'react';
export default function DigitalLibrary({played=[]}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState('');
 const playedIds=useMemo(()=>new Set(played.map(g=>String(g.titleId||''))),[played]);
 async function load(){
  setLoading(true);setError('');
  try{const r=await fetch('/mein-playstation/api/digital-library',{credentials:'same-origin',cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'PSN-Bibliothek nicht verfügbar');setData(j)}
  catch(e){setError(e.message||'Abruf fehlgeschlagen')}
  finally{setLoading(false)}
 }
 const games=(data?.titles||[]).filter(g=>g.name.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
 const unseen=(data?.titles||[]).filter(g=>!playedIds.has(g.titleId)).length;
 return <section className="psn-planner-box psn-digital-library"><h4>Digitale PSN-Bibliothek · Beta</h4>
  <p>Experimenteller Sony-Abruf digitaler Berechtigungen. Nicht gleichbedeutend mit Käufen oder Disc-Besitz.</p>
  <button className="psn-planner-button" type="button" onClick={load} disabled={loading}>{loading?'PSN-Lizenzen werden geladen …':data?'Bibliothek aktualisieren':'Digitale Lizenzen abrufen'}</button>
  {error?<p role="alert" className="psn-digital-error">{error.includes('SONY_LIBRARY_QUERY_EXPIRED')?'Sony hat den Bibliotheksaufruf verändert. Der Zugriff muss erneut angepasst werden.':error.includes('SONY_LIBRARY_HTTP_400')||error.includes('HTTP 400')?'Sony lehnt den Bibliotheksabruf derzeit ab (HTTP 400). Diese inoffizielle Funktion bleibt vorläufig Beta.':error.includes('SONY_LIBRARY_GRAPHQL')?'Sony meldet einen Fehler beim Bibliotheksabruf. Bitte später erneut versuchen.':error} <span>Deine PSN-Spielzeiten und Trophäen sind davon nicht betroffen.</span></p>:null}
  {data?<><div className="psn-digital-library-metrics"><div><strong>{data.titles.length}</strong><small>Geladene Berechtigungen</small></div><div><strong>{unseen}</strong><small>Nicht in der zuletzt-gespielt-Liste</small></div></div>
  {!data.complete?<p>Hinweis: Der Abruf konnte nicht als vollständig bestätigt werden (maximal 1.000 Einträge).</p>:null}
  <label>Digitale Bibliothek durchsuchen<input type="search" placeholder="Titel eingeben …" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="psn-digital-list">{games.slice(0,70).map(g=><div key={g.titleId}><strong>{g.name}</strong><small>{playedIds.has(g.titleId)?'In zuletzt gespielten Titeln':'Nicht in zuletzt gespielten Titeln'}</small></div>)}</div>
  {games.length>70?<p>{games.length-70} weitere Treffer – Suche eingrenzen.</p>:null}
  </>:null}
 </section>;
}
