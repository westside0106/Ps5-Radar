'use client';
import {useMemo,useState,useEffect} from 'react';
import DigitalLibrary from './DigitalLibrary';
import ProfileSync from './ProfileSync';
import GamingChronicle from './GamingChronicle';
import PlatinumTrophyGoals,{initialTrophyGoals} from './PlatinumTrophyGoals';
import {COLLECTIONS_KEY,normalizeCollections} from '../../lib/psn-game-collections.mjs';
const KEY='psn-game-planner-v1';
const HISTORY_KEY='psn-playtime-snapshots-v1';
const CUSTOM_KEY='psn-custom-games-v1';
const choices=[['planned','Geplant'],['playing','In Arbeit'],['paused','Pausiert'],['completed','Durchgespielt'],['platinum','Platin-Ziel']];
const norm=v=>String(v||'').trim().toLocaleLowerCase('de');
const getId=g=>String(g.titleId||g.name||g.titleName||'');
function mins(v){if(!v)return 0;if(typeof v==='number')return Math.max(0,v);const m=String(v).match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);return m?Number(m[1]||0)*1440+Number(m[2]||0)*60+Number(m[3]||0)+Number(m[4]||0)/60:0}
const hours=v=>Math.round(v/60).toLocaleString('de-DE');
const motionBehavior=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
export default function GamingPlanner({played=[],titles=[],focusGameId='',onFocusHandled}){
 const [notes,setNotes]=useState({});
 const [selected,setSelected]=useState('');
 const [draft,setDraft]=useState({status:'',favorite:false,note:''});
 const [trophyGoal,setTrophyGoal]=useState({setId:'',targetIds:[],doneIds:[]});
 const [savedNotice,setSavedNotice]=useState('');
 const [priorityFilter,setPriorityFilter]=useState('all');
 const [visibleBacklog,setVisibleBacklog]=useState(12);
 const [customGames,setCustomGames]=useState([]);
 const [newGame,setNewGame]=useState('');
 const [budget,setBudget]=useState(2);
 const [filter,setFilter]=useState('all');
 const [history,setHistory]=useState([]);
 const [importText,setImportText]=useState('');
 const [backupMessage,setBackupMessage]=useState('');
 useEffect(()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');if(data&&typeof data==='object'&&!Array.isArray(data))setNotes(data)}catch{}const onPlan=e=>{const id=String(e.detail?.id||'');if(!id)return;let info={};try{info=JSON.parse(localStorage.getItem(KEY)||'{}')?.[id]||{}}catch{}setSelected(id);setDraft({status:e.detail?.platinum?'platinum':info.status||'',favorite:!!info.favorite,note:info.note||'',priority:info.priority||'normal'});setTrophyGoal(initialTrophyGoals(played.find(g=>getId(g)===id),titles,info));setSavedNotice('');const panel=document.getElementById('psn-game-editor');const fold=panel?.closest('details');if(fold)fold.open=true;requestAnimationFrame(()=>panel?.scrollIntoView({behavior:motionBehavior(),block:'center'}))};window.addEventListener('psn-plan-game',onPlan);return()=>window.removeEventListener('psn-plan-game',onPlan)},[]);
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'[]');if(Array.isArray(v))setCustomGames(v.filter(g=>g&&typeof g.name==='string'&&/^custom:[a-z0-9-]{3,100}$/.test(g.titleId||'')).slice(0,400))}catch{}},[]);
 useEffect(()=>{
  const refresh=()=>{
   try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))setNotes(value)}catch{}
   try{const value=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'[]');if(Array.isArray(value))setCustomGames(value.filter(g=>g&&typeof g.name==='string'&&/^custom:[a-z0-9-]{3,100}$/.test(g.titleId||'')).slice(0,400))}catch{}
  };
  window.addEventListener('psn-profile-local-change',refresh);
  window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener('psn-profile-local-change',refresh);window.removeEventListener('storage',refresh)};
 },[]);
 useEffect(()=>{
  if(!focusGameId)return;
  let info={};
  try{info=JSON.parse(localStorage.getItem(KEY)||'{}')?.[focusGameId]||{}}catch{}
  setSelected(focusGameId);
  setDraft({status:'platinum',favorite:!!info.favorite,note:info.note||'',priority:info.priority||'normal'});
  setTrophyGoal(initialTrophyGoals(played.find(g=>getId(g)===focusGameId),titles,info));
  setSavedNotice('Bearbeite dein Platin-Ziel und speichere anschließend ausdrücklich.');
  const timeout=window.setTimeout(()=>{
   const panel=document.getElementById('psn-game-editor');
   const fold=panel?.closest('details');if(fold)fold.open=true;
   panel?.scrollIntoView({behavior:motionBehavior(),block:'center'});
   onFocusHandled?.();
  },90);
  return()=>window.clearTimeout(timeout);
 },[focusGameId]);
 useEffect(()=>setVisibleBacklog(12),[filter,priorityFilter]);
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
 const games=useMemo(()=>[...played.filter(g=>!(/^(youtube|spotify|netflix|twitch|prime video|disney\+|apple tv)$/i.test(String(g.name||'')))),...customGames].map(g=>({key:getId(g),name:g.name||g.titleName||'Spiel',game:g})).filter(g=>g.key),[played,customGames]);
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
 const topPlayed=useMemo(()=>[...games].filter(g=>mins(g.game.playDuration)>0).sort((a,b)=>mins(b.game.playDuration)-mins(a.game.playDuration)).slice(0,5),[games]);
 const recentGameList=useMemo(()=>[...games].filter(g=>g.game.lastPlayedDateTime&&!Number.isNaN(new Date(g.game.lastPlayedDateTime).getTime())).sort((a,b)=>new Date(b.game.lastPlayedDateTime)-new Date(a.game.lastPlayedDateTime)).slice(0,5),[games]);
 const activeDates=activity.filter(day=>day.count>0).sort((a,b)=>b.count-a.count||b.day.localeCompare(a.day));
 const ranked=useMemo(()=>games.filter(x=>(filter==='all'?Boolean(notes[x.key]?.status||notes[x.key]?.favorite||notes[x.key]?.note):notes[x.key]?.status===filter)&&(priorityFilter==='all'||notes[x.key]?.priority===priorityFilter)).sort((a,b)=>Number(notes[b.key]?.priority==='high')-Number(notes[a.key]?.priority==='high')||(notes[b.key]?.favorite?1:0)-(notes[a.key]?.favorite?1:0)||mins(a.game.playDuration)-mins(b.game.playDuration)),[games,notes,filter,priorityFilter]);
 const recommendation=useMemo(()=>{
  const eligible=games.filter(g=>notes[g.key]?.status!=='completed');
  const score=g=>{
   const info=notes[g.key]||{},status=info.status;
   const priority=info.priority==='high'?50:info.priority==='low'?-12:0;
   const favorite=info.favorite?20:0;
   const shortSession=budget<=2;
   const continuation=status==='playing'||status==='platinum'?(shortSession?45:25):0;
   const planned=status==='planned'?(shortSession?5:24):0;
   const recentlyPlayed=Number.isFinite(Date.parse(g.game.lastPlayedDateTime||''))?Math.max(0,15-Math.floor((Date.now()-Date.parse(g.game.lastPlayedDateTime))/86400000)):0;
   return priority+favorite+continuation+planned+recentlyPlayed;
  };
  return [...eligible].sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name,'de'))[0]||null;
 },[games,notes,budget]);
 function addManualGame(){
  const name=newGame.trim().replace(/\s+/g,' ').slice(0,120);
  if(name.length<3){setSavedNotice('Bitte mindestens drei Zeichen als Spielnamen eingeben.');return}
  const clash=games.find(g=>norm(g.name)===norm(name));
  if(clash){setSavedNotice('Das Spiel ist bereits in deiner Sammlung.');selectGame(clash.key);return}
  const id='custom:'+name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);
  if(id.length<10){setSavedNotice('Bitte einen eindeutigeren Spielnamen eingeben.');return}
  const game={titleId:id,name,isManual:true};
  const nextGames=[...customGames,game],nextNotes={...notes,[id]:{status:'planned',priority:'normal',favorite:false,note:'',updatedAt:new Date().toISOString()}};
  const previous=[[CUSTOM_KEY,localStorage.getItem(CUSTOM_KEY)],[KEY,localStorage.getItem(KEY)]];
  try{
   localStorage.setItem(CUSTOM_KEY,JSON.stringify(nextGames));
   localStorage.setItem(KEY,JSON.stringify(nextNotes));
   setCustomGames(nextGames);setNotes(nextNotes);
   setNewGame('');setSelected(id);
   setDraft({status:'planned',priority:'normal',favorite:false,note:''});
   setTrophyGoal({setId:'',targetIds:[],doneIds:[]});
   setSavedNotice('Spiel ohne PSN-Aktivität hinzugefügt und lokal gespeichert.');
   window.dispatchEvent(new Event('psn-profile-local-change'));
  }catch{
   for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}catch{}}
   setSavedNotice('Speichern nicht möglich. Browser-Speicher prüfen.');
  }
 }
 function exportBackup(){
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),notes,history:read(HISTORY_KEY,[]),covers:read('psn-cover-preferences-v1',{}),coverUrls:read('psn-cover-urls-v1',{}),manualGames:read(CUSTOM_KEY,[]),collections:read(COLLECTIONS_KEY,[]),trophyTargets:read('psn-trophy-targets-v1',{}),platinumChecks:read('psn-platinum-checks-v1',{})},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ps5-radar-komplett-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  setBackupMessage('Vollständiges lokales Backup erstellt. Datei enthält deine persönlichen Notizen und Trophäenziele; sicher aufbewahren.');
 }
 function importBackup(){
  try{
   const raw=JSON.parse(importText);
   if(![1,2].includes(raw?.version)||!raw.notes||typeof raw.notes!=='object'||Array.isArray(raw.notes))throw Error('Ungültiges Backupformat');
   const clean={};for(const [k,v] of Object.entries(raw.notes).slice(0,3000)){if(!k||k.length>180||!v||typeof v!=='object'||Array.isArray(v))continue;clean[k]={status:choices.some(c=>c[0]===v.status)?v.status:'',favorite:v.favorite===true,note:String(v.note||'').slice(0,800),trophySetId:typeof v.trophySetId==='string'&&/^[a-zA-Z0-9_-]{4,100}$/.test(v.trophySetId)?v.trophySetId:'',priority:['high','normal','low'].includes(v.priority)?v.priority:'normal'}}
   const merged={...notes,...clean};
   const changes=[[KEY,merged]];
   if(raw.version===2){
    if(Array.isArray(raw.manualGames)){
     const restored=raw.manualGames.filter(g=>g&&typeof g.name==='string'&&/^custom:[a-z0-9-]{3,100}$/.test(g.titleId||'')).slice(0,400);
     const mergedGames=new Map([...customGames,...restored].map(g=>[g.titleId,{titleId:g.titleId,name:String(g.name).slice(0,120),isManual:true}]));
     changes.push([CUSTOM_KEY,[...mergedGames.values()]]);
    }
    if(Array.isArray(raw.collections)){
     let existing=[];try{existing=normalizeCollections(JSON.parse(localStorage.getItem(COLLECTIONS_KEY)||'[]'))}catch{}
     const mergedCollections=new Map(existing.map(c=>[c.id,c]));
     for(const c of normalizeCollections(raw.collections)){
      const old=mergedCollections.get(c.id);
      mergedCollections.set(c.id,old?{...old,gameIds:[...new Set([...old.gameIds,...c.gameIds])].slice(0,1500)}:c);
     }
     changes.push([COLLECTIONS_KEY,normalizeCollections([...mergedCollections.values()])]);
    }
    if(Array.isArray(raw.history)){
     const mergedHistory=[...history,...raw.history].filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(x.minutes)&&x.minutes>=0&&Number.isInteger(x.games)&&x.games>=0).sort((a,b)=>a.date.localeCompare(b.date));
     const byDate=new Map(mergedHistory.map(x=>[x.date,{date:x.date,minutes:Math.round(x.minutes),games:x.games}]));
     const list=[...byDate.values()].slice(-365);changes.push([HISTORY_KEY,list]);
    }
    const fields=[['covers','psn-cover-preferences-v1',v=>v==='steamgriddb'||v==='original'],['coverUrls','psn-cover-urls-v1',v=>typeof v==='string'&&/^https:\/\/[a-z0-9.-]+\.steamgriddb\.com\//i.test(v)],['trophyTargets','psn-trophy-targets-v1',v=>Array.isArray(v)],['platinumChecks','psn-platinum-checks-v1',v=>Array.isArray(v)]];
    for(const [field,key,validate] of fields){const obj=raw[field];if(!obj||typeof obj!=='object'||Array.isArray(obj))continue;const cleaned={};for(const [id,value] of Object.entries(obj).slice(0,3000)){if(!id||id.length>180||!validate(value))continue;cleaned[id]=Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.length<100).slice(0,400):value}let existing={};try{existing=JSON.parse(localStorage.getItem(key)||'{}')}catch{}changes.push([key,{...(existing&&typeof existing==='object'&&!Array.isArray(existing)?existing:{}),...cleaned}])}
   }
   // Validate all data before applying changes; avoid silently discarding existing local settings.
   const previous=changes.map(([key])=>[key,localStorage.getItem(key)]);
   try{for(const [key,value] of changes)localStorage.setItem(key,JSON.stringify(value))}
   catch(error){for(const [key,value] of previous){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}throw error}
   setNotes(merged);const restored=changes.find(x=>x[0]===HISTORY_KEY);if(restored)setHistory(restored[1]);const manual=changes.find(x=>x[0]===CUSTOM_KEY);if(manual)setCustomGames(manual[1]);
   window.dispatchEvent(new Event('psn-profile-local-change'));
   setImportText('');setBackupMessage(Object.keys(clean).length+' Spieleinträge importiert'+(raw.version===2?' · inklusive unterstützter weiterer Daten':'')+'. Für Cover-/Trophäen-Zielanzeigen die Seite neu laden.');
  }catch{setBackupMessage('Import fehlgeschlagen – Dateiformat oder Browser-Speicher prüfen. Vorhandene Daten sollten unverändert bleiben.')}
 }
 function selectGame(id,platinum=false){setSelected(id);const current=notes[id]||{};setDraft({status:platinum?'platinum':current.status||'',favorite:!!current.favorite,note:current.note||'',priority:current.priority||'normal'});setTrophyGoal(initialTrophyGoals(played.find(g=>getId(g)===id),titles,current));setSavedNotice('');const panel=document.getElementById('psn-game-editor');const fold=panel?.closest('details');if(fold)fold.open=true;requestAnimationFrame(()=>panel?.scrollIntoView({behavior:motionBehavior(),block:'center'}));}
 function saveDraft(){
  if(!selected)return;
  const readObject=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}};
  const entry={...draft,trophySetId:trophyGoal.setId||undefined,updatedAt:new Date().toISOString()};
  const changes=[[KEY,{...notes,[selected]:entry}]];
  if(trophyGoal.setId){
   const targetKey='psn-trophy-targets-v1',doneKey='psn-platinum-checks-v1';
   const selectedIds=[...new Set(trophyGoal.targetIds)].slice(0,300);
   changes.push([targetKey,{...readObject(targetKey),[trophyGoal.setId]:selectedIds}]);
   changes.push([doneKey,{...readObject(doneKey),[trophyGoal.setId]:[...new Set(trophyGoal.doneIds.filter(id=>selectedIds.includes(id)))].slice(0,300)}]);
  }
  const previous=changes.map(([key])=>[key,localStorage.getItem(key)]);
  try{
   for(const [key,data] of changes)localStorage.setItem(key,JSON.stringify(data));
   setNotes(changes[0][1]);
   setSavedNotice('Gespeichert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+'.'+(trophyGoal.setId?' Trophäen-Ziele übernommen.':'')+' Cloud-Sicherung im Datenbereich.');
   window.dispatchEvent(new Event('psn-profile-local-change'));
   window.dispatchEvent(new Event('psn-trophy-targets-change'));
  }catch{
   for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}catch{}}
   setSavedNotice('Speichern nicht möglich. Browser-Speicher prüfen.');
  }
 }
 const focused=games.find(g=>g.key===selected)||null;
 const statuses=Object.fromEntries(choices.map(([key])=>[key,games.filter(g=>notes[g.key]?.status===key).length]));
 return <section className="psn-planner" aria-label="Spielplaner und Statistiken">
  <div className="psn-planner-heading"><h3>Weitere Funktionen</h3><small>Pläne, Fortschritt und Datensicherung</small></div>
  <div className="psn-planner-stats"><div><small>Spiele inkl. eigener Einträge</small><strong>{games.length}</strong></div><div><small>PSN-Spielzeit</small><strong>{hours(stats.total)} Std.</strong></div><div><small>Mit Status</small><strong>{stats.tracked}</strong></div><div><small>100 % Trophäen</small><strong>{stats.completed}</strong></div></div>
  <details className="psn-tools-fold"><summary>Spiele planen &amp; Backlog <span>Favoriten, Status und Empfehlungen</span></summary><div className="psn-tools-fold-body">  <div className="psn-planner-panels"><div className="psn-planner-box"><h4>Spielvorschlag</h4><p className="psn-muted">Priorisiert deine laufenden Ziele, Favoriten und selbst gesetzten Prioritäten. Kein Versprechen, dass ein Spiel in das Zeitbudget passt.</p><label>Zeitbudget <select value={budget} onChange={e=>setBudget(Number(e.target.value))}><option value="1">1 Stunde</option><option value="2">2 Stunden</option><option value="4">4 Stunden</option><option value="8">8 Stunden</option></select></label>{recommendation?<p><strong>{recommendation.name}</strong>{notes[recommendation.key]?.priority==='high'?<small> · Deine hohe Priorität</small>:null}</p>:<p>Keine Spiele verfügbar.</p>}</div>
  <div id="psn-game-editor" className="psn-planner-box psn-editor"><h4>Mein Spielplan</h4><p className="psn-muted">Spiel auswählen, Ziele festlegen und ausdrücklich speichern.</p><label>Spiel<select value={selected} onChange={e=>selectGame(e.target.value)}><option value="">Spiel auswählen …</option>{games.map(g=><option key={g.key} value={g.key}>{g.name}</option>)}</select></label><div className="psn-add-manual-game"><label>Noch nicht gespieltes Spiel vormerken<input value={newGame} onChange={e=>setNewGame(e.target.value)} maxLength={120} placeholder="Titel eingeben …"/></label><button type="button" disabled={!newGame.trim()} onClick={addManualGame}>Zum Backlog hinzufügen</button><small>Manuell angelegte Spiele besitzen zunächst keine PSN-Spielzeit oder Trophäen.</small></div>{focused?<><label>Status<select value={draft.status} onChange={e=>{setDraft(d=>({...d,status:e.target.value}));setSavedNotice('Nicht gespeicherte Änderungen')}}><option value="">Ohne Einordnung</option>{choices.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>Priorität<select value={draft.priority||'normal'} onChange={e=>{setDraft(d=>({...d,priority:e.target.value}));setSavedNotice('Nicht gespeicherte Änderungen')}}><option value="high">Hoch – als Nächstes</option><option value="normal">Normal</option><option value="low">Später</option></select></label><label className="psn-planner-check"><input type="checkbox" checked={draft.favorite} onChange={e=>{setDraft(d=>({...d,favorite:e.target.checked}));setSavedNotice('Nicht gespeicherte Änderungen')}}/> Favorit</label><label>Meine Notiz / nächstes Ziel<textarea maxLength={800} rows={3} placeholder="Zum Beispiel: Bei AC Shadows die restlichen Trophäen erreichen" value={draft.note} onChange={e=>{setDraft(d=>({...d,note:e.target.value}));setSavedNotice('Nicht gespeicherte Änderungen')}}/></label>{draft.status==='platinum'?<PlatinumTrophyGoals game={focused.game} titles={titles} goal={trophyGoal} onChange={setTrophyGoal} onDirty={()=>setSavedNotice('Nicht gespeicherte Trophäen-Ziele')}/>:null}<button type="button" className="psn-planner-button psn-save-plan" onClick={saveDraft}>Spielplan speichern</button>{savedNotice?<p className="psn-save-status" role="status">{savedNotice}</p>:null}</>:<p className="psn-muted">Noch kein Spiel ausgewählt.</p>}</div></div>
  <div className="psn-planner-box"><h4>Mein Backlog</h4><p className="psn-muted">Hier erscheinen nur Spiele, für die du einen Plan gespeichert hast. Hoch priorisierte Titel zuerst.</p><div className="psn-planner-filters"><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Meine Einträge ({games.filter(g=>notes[g.key]?.status||notes[g.key]?.favorite||notes[g.key]?.note).length})</button>{choices.map(([v,label])=><button key={v} type="button" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{label} ({statuses[v]})</button>)}</div><label className="psn-priority-filter">Priorität <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}><option value="all">Alle</option><option value="high">Hoch</option><option value="normal">Normal</option><option value="low">Später</option></select></label>{!ranked.length?<p className="psn-muted">Noch keine gespeicherten Spielpläne. Wähle oben einen Titel aus, lege einen Status fest und tippe auf „Spielplan speichern“.</p>:null}<div className="psn-planner-items">{ranked.slice(0,visibleBacklog).map(g=><button key={g.key} type="button" onClick={()=>selectGame(g.key)}><span>{notes[g.key]?.priority==='high'?'↑ ':''}{notes[g.key]?.favorite?'★ ':''}{g.name}</span><small>{choices.find(c=>c[0]===notes[g.key]?.status)?.[1]||'Offen'} · {notes[g.key]?.priority==='high'?'Hohe Priorität · ':''}{g.game.isManual?'Noch nicht auf PSN gespielt':hours(mins(g.game.playDuration))+' Std.'}</small></button>)}</div>{ranked.length>visibleBacklog?<button type="button" className="psn-planner-button psn-show-more" onClick={()=>setVisibleBacklog(n=>n+12)}>Weitere Spiele anzeigen ({ranked.length-visibleBacklog} übrig)</button>:null}</div>
  <div className="psn-planner-box"><h4>Platin-Kandidaten</h4><p>Ungefähre Platin-Dauer aus historischen Schätzungen. Kein garantierter Restaufwand. Tippe auf ein Spiel, um es als Platin-Ziel vorzumerken und anschließend zu speichern.</p><div className="psn-planner-items">{games.filter(g=>g.game.communityInsight?.platinumHours!=null).sort((a,b)=>a.game.communityInsight.platinumHours-b.game.communityInsight.platinumHours).slice(0,8).map(g=><button type="button" key={g.key} onClick={()=>selectGame(g.key,true)}><span>{g.name}</span><small>Platin-Schätzung: {g.game.communityInsight.platinumHours} Std. · bisher {hours(mins(g.game.playDuration))} Std. PSN</small></button>)}</div></div>
</div></details>
  <details className="psn-tools-fold"><summary>Gaming-Chronik &amp; Statistiken <span>PSN-Messpunkte, Monatsvergleich und letzte Spieltage</span></summary><div className="psn-tools-fold-body">  <div className="psn-planner-box psn-stats-ranking"><h4>Meine meistgespielten Titel</h4><p>PSN-Gesamtspielzeit je Titel, nicht nur die letzten 28 Tage.</p><div className="psn-stats-rank-list">{topPlayed.map((g,i)=><div key={g.key}><span>{i+1}. {g.name}</span><strong>{hours(mins(g.game.playDuration))} Std.</strong></div>)}</div><h4 className="psn-stats-subheading">Zuletzt aktive Titel</h4><div className="psn-stats-rank-list">{recentGameList.map(g=><div key={g.key}><span>{g.name}</span><strong>{new Date(g.game.lastPlayedDateTime).toLocaleDateString('de-DE')}</strong></div>)}</div></div>
  <GamingChronicle played={played} history={history}/>
  <div className="psn-planner-box"><h4>Letzte Spieltage nach Titeln</h4><p>{totalRecent} verschiedene Titel haben ihren letzten von PSN gemeldeten Spieltag in den vergangenen 28 Tagen. Die Balken zeigen die Anzahl der Titel pro Datum, nicht Spielsitzungen oder Spielstunden.</p><div className="psn-activity-ranked">{activeDates.slice(0,12).map(day=><div key={day.day} className="psn-activity-row"><span>{day.date}</span><div className="psn-activity-track"><span style={{width:(day.count/Math.max(1,activeDates[0]?.count||1)*100)+"%"}}/></div><strong>{day.count} Titel</strong></div>)}</div></div>
</div></details>
  <details className="psn-tools-fold"><summary>Daten &amp; Synchronisierung <span>Cloud, Backup und PSN-Lizenzen</span></summary><div className="psn-tools-fold-body">  <DigitalLibrary played={played}/>
  <ProfileSync/>
  <div className="psn-planner-box"><h4>Backup &amp; Wiederherstellung</h4><p>Speichere deine eigenen Angaben als Datei oder importiere sie auf einem anderen Gerät.</p><button className="psn-planner-button" type="button" onClick={exportBackup}>Komplettes Backup sichern</button><label>Backup-Datei importieren<input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>1500000){setBackupMessage('Datei zu groß.');return}setImportText(await f.text())}}/></label><button className="psn-planner-button" type="button" disabled={!importText} onClick={importBackup}>Backup einspielen</button>{backupMessage?<p role="status">{backupMessage}</p>:null}</div>
</div></details>
  <p className="psn-planner-foot">Wichtig: Die PSN-Spielzeit ist kumuliert, keine Sitzungs-Historie. Trophäen-100 % bedeutet nicht automatisch Platin. Persönliche Angaben werden lokal gespeichert; eine Cloud-Sicherung ist optional. PlayStation liefert hier keine vollständige Sitzungs-Historie.</p>
 </section>;
}
