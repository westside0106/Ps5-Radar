'use client';
import {useMemo,useState,useEffect} from 'react';
import DigitalLibrary from './DigitalLibrary';
import ProfileSync from './ProfileSync';
const KEY='psn-game-planner-v1';
const HISTORY_KEY='psn-playtime-snapshots-v1';
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
 const [history,setHistory]=useState([]);
 const [importText,setImportText]=useState('');
 const [backupMessage,setBackupMessage]=useState('');
 useEffect(()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');if(data&&typeof data==='object'&&!Array.isArray(data))setNotes(data)}catch{}},[]);
 useEffect(()=>{
  // A local daily snapshot of cumulative PSN playtimes, not a real session log.
  try{
   const previous=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
   const records=Array.isArray(previous)?previous.filter(x=>x&&typeof x.date==='string'&&typeof x.minutes==='number').slice(-365):[];
   const date=new Date().toLocaleDateString('sv-SE');
   const total=played.reduce((sum,g)=>sum+mins(g.playDuration),0);
   const last=records[records.length-1];
   // Store only nonempty readings; today's latest reading replaces today's earlier snapshot.
   if(played.length&&(last?.date!==date||last.minutes!==total)){
    if(last?.date===date)records.pop();
    records.push({date,minutes:Math.round(total),games:played.length});
    localStorage.setItem(HISTORY_KEY,JSON.stringify(records.slice(-365)));
   }
   setHistory(records.slice(-365));
  }catch{}
 },[played]);
 const changes=useMemo(()=>history.slice(1).map((x,i)=>({date:x.date,change:Math.max(0,x.minutes-history[i].minutes),comparable:x.games===history[i].games})),[history]);
 const games=useMemo(()=>played.filter(g=>!(/^(youtube|spotify|netflix|twitch|prime video|disney\+|apple tv)$/i.test(String(g.name||'')))).map(g=>({key:getId(g),name:g.name||g.titleName||'Spiel',game:g})).filter(g=>g.key),[played]);
 const stats=useMemo(()=>{
  const times=games.map(x=>mins(x.game.playDuration));
  const total=times.reduce((a,v)=>a+v,0);
  const tracked=games.filter(x=>notes[x.key]?.status).length;
  const trophyByName=new Map(titles.map(t=>[norm(t.trophyTitleName),Number(t.progress)||0]));
  const progress=games.map(g=>({...g,trophy:trophyByName.get(norm(g.name))??null})).filter(g=>g.trophy!==null);
  return {total,tracked,progress,completed:progress.filter(x=>x.trophy===100).length};
 },[games,notes,titles]);
 const activity=useMemo(()=>{const days=Array.from({length:28},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-27+i);return {day:d.toISOString().slice(0,10),date:d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}),count:0};});const byDay=new Map(days.map(d=>[d.day,d]));for(const g of games){const v=g.game.lastPlayedDateTime;if(!v)continue;const date=new Date(v);if(Number.isNaN(date.getTime()))continue;const key=date.toISOString().slice(0,10);if(byDay.has(key))byDay.get(key).count++}return days},[games]);
 const totalRecent=activity.reduce((n,d)=>n+d.count,0);
 const ranked=useMemo(()=>games.filter(x=>filter==='all'||notes[x.key]?.status===filter).sort((a,b)=>(notes[b.key]?.favorite?1:0)-(notes[a.key]?.favorite?1:0)||mins(a.game.playDuration)-mins(b.game.playDuration)),[games,notes,filter]);
 const recommendation=useMemo(()=>{
  const eligible=games.filter(g=>!['completed'].includes(notes[g.key]?.status));
  const fits=eligible.filter(g=>{const estimate=g.game.communityInsight?.rushedHours;return estimate==null||estimate<=budget*6});
  return (fits.length?fits:eligible).sort((a,b)=>Number(!!notes[b.key]?.favorite)-Number(!!notes[a.key]?.favorite)||Number(b.game.lastPlayedDateTime?new Date(b.game.lastPlayedDateTime):0)-Number(a.game.lastPlayedDateTime?new Date(a.game.lastPlayedDateTime):0))[0]||null;
 },[games,notes,budget]);
 function exportBackup(){
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),notes,history:read(HISTORY_KEY,[]),covers:read('psn-cover-preferences-v1',{}),trophyTargets:read('psn-trophy-targets-v1',{})},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ps5-radar-komplett-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  setBackupMessage('Vollständiges lokales Backup erstellt. Datei enthält deine persönlichen Notizen und Trophäenziele; sicher aufbewahren.');
 }
 function importBackup(){
  try{
   const raw=JSON.parse(importText);
   if(![1,2].includes(raw?.version)||!raw.notes||typeof raw.notes!=='object'||Array.isArray(raw.notes))throw Error('Ungültiges Backupformat');
   const clean={};for(const [k,v] of Object.entries(raw.notes).slice(0,3000)){if(!k||k.length>180||!v||typeof v!=='object'||Array.isArray(v))continue;clean[k]={status:choices.some(c=>c[0]===v.status)?v.status:'',favorite:v.favorite===true,note:String(v.note||'').slice(0,800)}}
   const merged={...notes,...clean};
   const changes=[[KEY,merged]];
   if(raw.version===2){
    if(Array.isArray(raw.history)){
     const mergedHistory=[...history,...raw.history].filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(x.minutes)&&x.minutes>=0&&Number.isInteger(x.games)&&x.games>=0).sort((a,b)=>a.date.localeCompare(b.date));
     const byDate=new Map(mergedHistory.map(x=>[x.date,{date:x.date,minutes:Math.round(x.minutes),games:x.games}]));
     const list=[...byDate.values()].slice(-365);changes.push([HISTORY_KEY,list]);
    }
    const fields=[['covers','psn-cover-preferences-v1',v=>v==='steamgriddb'||v==='original'],['trophyTargets','psn-trophy-targets-v1',v=>Array.isArray(v)]];
    for(const [field,key,validate] of fields){const obj=raw[field];if(!obj||typeof obj!=='object'||Array.isArray(obj))continue;const cleaned={};for(const [id,value] of Object.entries(obj).slice(0,3000)){if(!id||id.length>180||!validate(value))continue;cleaned[id]=Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.length<100).slice(0,400):value}let existing={};try{existing=JSON.parse(localStorage.getItem(key)||'{}')}catch{}changes.push([key,{...(existing&&typeof existing==='object'&&!Array.isArray(existing)?existing:{}),...cleaned}])}
   }
   // Validate all data before applying changes; avoid silently discarding existing local settings.
   const previous=changes.map(([key])=>[key,localStorage.getItem(key)]);
   try{for(const [key,value] of changes)localStorage.setItem(key,JSON.stringify(value))}
   catch(error){for(const [key,value] of previous){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}throw error}
   setNotes(merged);const restored=changes.find(x=>x[0]===HISTORY_KEY);if(restored)setHistory(restored[1]);
   setImportText('');setBackupMessage(Object.keys(clean).length+' Spieleinträge importiert'+(raw.version===2?' · inklusive unterstützter weiterer Daten':'')+'. Für Cover-/Trophäen-Zielanzeigen die Seite neu laden.');
  }catch{setBackupMessage('Import fehlgeschlagen – Dateiformat oder Browser-Speicher prüfen. Vorhandene Daten sollten unverändert bleiben.')}
 }
 function save(id,patch){setNotes(old=>{const next={...old,[id]:{...(old[id]||{}),...patch}};try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}return next})}
 const focused=games.find(g=>g.key===selected)||null;
 const statuses=Object.fromEntries(choices.map(([key])=>[key,games.filter(g=>notes[g.key]?.status===key).length]));
 return <section className="psn-planner" aria-label="Spielplaner und Statistiken">
  <div className="psn-planner-heading"><h3>Weitere Funktionen</h3><small>Nur öffnen, was du brauchst</small></div>
  <div className="psn-planner-stats"><div><small>Erfasste Spiele</small><strong>{games.length}</strong></div><div><small>PSN-Spielzeit</small><strong>{hours(stats.total)} Std.</strong></div><div><small>Mit Status</small><strong>{stats.tracked}</strong></div><div><small>100 % Trophäen</small><strong>{stats.completed}</strong></div></div>
  <details className="psn-tools-fold"><summary>Spiele planen &amp; Backlog <span>Favoriten, Status und Empfehlungen</span></summary><div className="psn-tools-fold-body">  <div className="psn-planner-panels"><div className="psn-planner-box"><h4>Heute spielen</h4><label>Mein Zeitbudget <select value={budget} onChange={e=>setBudget(Number(e.target.value))}><option value="1">1 Stunde</option><option value="2">2 Stunden</option><option value="4">4 Stunden</option><option value="8">8 Stunden</option></select></label>{recommendation?<p><strong>{recommendation.name}</strong><small> Vorschlag aus deinen zuletzt gespielten Titeln; kein Live-Tracking</small></p>:<p>Keine Spiele verfügbar.</p>}</div>
  <div className="psn-planner-box"><h4>Spiel vormerken</h4><label>Spiel auswählen<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Spiel auswählen …</option>{games.map(g=><option key={g.key} value={g.key}>{g.name}</option>)}</select></label>{focused?<><label>Status<select value={notes[selected]?.status||''} onChange={e=>save(selected,{status:e.target.value})}><option value="">Noch nicht eingestuft</option>{choices.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label className="psn-planner-check"><input type="checkbox" checked={!!notes[selected]?.favorite} onChange={e=>save(selected,{favorite:e.target.checked})}/> Favorit</label><label>Meine Notiz<textarea maxLength={800} rows={2} placeholder="Was möchte ich noch erledigen?" value={notes[selected]?.note||''} onChange={e=>save(selected,{note:e.target.value})}/></label></>:null}</div></div>
  <div className="psn-planner-box"><h4>Mein Backlog</h4><div className="psn-planner-filters"><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Alle ({games.length})</button>{choices.map(([v,label])=><button key={v} type="button" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{label} ({statuses[v]})</button>)}</div><div className="psn-planner-items">{ranked.slice(0,12).map(g=><button key={g.key} type="button" onClick={()=>setSelected(g.key)}><span>{notes[g.key]?.favorite?'★ ':''}{g.name}</span><small>{choices.find(c=>c[0]===notes[g.key]?.status)?.[1]||'Offen'} · {hours(mins(g.game.playDuration))} Std.</small></button>)}</div>{ranked.length>12?<small>Die ersten 12 Spiele werden angezeigt. Über die Filter eingrenzen.</small>:null}</div>
  <div className="psn-planner-box"><h4>Platin-Kandidaten</h4><p>Ungefähre Platin-Dauer aus historischen Schätzungen. Kein garantierter Restaufwand.</p><div className="psn-planner-items">{games.filter(g=>g.game.communityInsight?.platinumHours!=null).sort((a,b)=>a.game.communityInsight.platinumHours-b.game.communityInsight.platinumHours).slice(0,8).map(g=><button type="button" key={g.key} onClick={()=>setSelected(g.key)}><span>{g.name}</span><small>Platin-Schätzung: {g.game.communityInsight.platinumHours} Std. · bisher {hours(mins(g.game.playDuration))} Std. PSN</small></button>)}</div></div>
</div></details>
  <details className="psn-tools-fold"><summary>Statistiken &amp; Verlauf <span>Letzte Spieltage und Zeitentwicklung</span></summary><div className="psn-tools-fold-body">  <div className="psn-planner-box"><h4>Spielzeit-Verlauf</h4><p>Kumulierte Spielzeit bei deinen Seitenaufrufen. Keine einzelnen Spielsitzungen.</p>{history.length>1?<div className="psn-snapshot-bars" aria-label="Differenzen zwischen lokalen PSN-Snapshots">{changes.slice(-14).map(x=><div key={x.date} title={x.date+': '+(x.comparable?Math.round(x.change/60*10)/10+' Stunden Zuwachs':'Spielanzahl verändert')}><span style={{height:(x.comparable?Math.max(5,Math.min(100,x.change/120*100)):5)+'%'}} className={x.comparable?'':'is-uncertain'}/><small>{x.date.slice(5)}</small></div>)}</div>:<p>Der Verlauf beginnt mit dem zweiten Messtag. Aktuell {history.length} Messpunkt.</p>}<small>Lokale Daten, keine echten Spielsessions.</small></div>
  <div className="psn-planner-box"><h4>Spielaktivität · 28 Tage</h4><p>Je Spiel nur der letzte erfasste Spieltag – keine täglichen Spielstunden. {totalRecent} Titel im Zeitraum.</p><div className="psn-activity-days" role="img" aria-label="28 Tage, nach Datum des jeweils letzten Spielstarts gruppiert">{activity.map(day=><span key={day.day} className={'psn-activity-day '+(day.count?'is-active':'')} style={{opacity:day.count?Math.min(1,.3+day.count*.22):.22}} title={day.date+': '+day.count+' zuletzt gespielte Spiele'}/>)}</div></div>
</div></details>
  <details className="psn-tools-fold"><summary>Daten &amp; Synchronisierung <span>Cloud, Backup und PSN-Lizenzen</span></summary><div className="psn-tools-fold-body">  <DigitalLibrary played={played}/>
  <ProfileSync/>
  <div className="psn-planner-box"><h4>Backup &amp; Wiederherstellung</h4><p>Speichere deine eigenen Angaben als Datei oder importiere sie auf einem anderen Gerät.</p><button className="psn-planner-button" type="button" onClick={exportBackup}>Komplettes Backup sichern</button><label>Backup-Datei importieren<input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>1500000){setBackupMessage('Datei zu groß.');return}setImportText(await f.text())}}/></label><button className="psn-planner-button" type="button" disabled={!importText} onClick={importBackup}>Backup einspielen</button>{backupMessage?<p role="status">{backupMessage}</p>:null}</div>
</div></details>
  <p className="psn-planner-foot">Wichtig: Die PSN-Spielzeit ist kumuliert, keine Sitzungs-Historie. Trophäen-100 % bedeutet nicht automatisch Platin. Backlog und Favoriten werden nur lokal auf diesem Gerät gespeichert.</p>
 </section>;
}
