'use client';
import {useMemo,useState,useEffect} from 'react';
import {buildPlaytimeInsights,buildTrophyInsights,playDurationMinutes} from '../../lib/psn-advanced-stats.mjs';
import styles from './CommandDeck.module.css';

function imageOf(game){
 const candidate=game?.metadata?.coverUrl||game?.imageUrl||game?.trophyTitleIconUrl||game?.image?.url||game?.media?.coverUrl||game?.images?.[0]?.url;
 return typeof candidate==='string'&&/^https:\/\//i.test(candidate)?candidate:null;
}
function displayHours(minutes){
 return Number.isFinite(minutes)?(minutes/60).toLocaleString('de-DE',{maximumFractionDigits:1})+' h':'—';
}
function lastPlayed(game){
 const time=Date.parse(game?.lastPlayedDateTime||'');
 return Number.isFinite(time)?time:null;
}
function Picture({game,className}){
 const [failed,setFailed]=useState(false);
 const src=imageOf(game);
 useEffect(()=>setFailed(false),[src]);
 return <div className={className}>{src&&!failed?<img key={src} src={src} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt="" onError={()=>setFailed(true)}/>:<span className={styles.imageFallback}>PS / R</span>}</div>;
}
function goTo(id){
 const element=document.getElementById(id);
 if(!element)return;
 if(element.tagName==='DETAILS')element.open=true;
 else element.closest('details')?.setAttribute('open','');
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 requestAnimationFrame(()=>element.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'}));
}
export default function CommandDeck({played=[],titles=[],notes={}}){
 const play=useMemo(()=>buildPlaytimeInsights(played),[played]);
 const trophy=useMemo(()=>buildTrophyInsights(titles),[titles]);
 const featured=useMemo(()=>[...played].filter(g=>g&&(g.name||g.titleName)&&!(/^(?:youtube|spotify|netflix|twitch|prime video|disney\+|apple tv)$/i.test(g.name||g.titleName||'')))
 .sort((a,b)=>(lastPlayed(b)??-1)-(lastPlayed(a)??-1)).slice(0,4),[played]);
 const top=featured[0]||null;
 const totalTrophies=Object.values(trophy.earned).reduce((a,b)=>a+b,0);
 const planned=Object.values(notes||{}).filter(x=>x?.status).length;
 const last=lastPlayed(top);
 return <section className={styles.deck} aria-label="PlayStation Radar Mission Control">
  <div className={styles.gridOverlay} aria-hidden="true"/>
  <header className={styles.topbar}>
   <div className={styles.identity}><span className={styles.mark} aria-hidden="true">R<span>Ξ</span></span><span><strong>PLAYSTATION RADAR</strong><small>PERSONAL COMMAND SYSTEM</small></span></div>
   <span className={styles.status}><i aria-hidden="true"/> PSN-DATEN · PRIVAT</span>
  </header>
  <div className={styles.main}>
   <div className={styles.headline}>
    <p className={styles.kicker}><span className={styles.line}/> YOUR GAME. YOUR LEGACY. <span className={styles.index}>// 01</span></p>
    <h2>DEIN SPIEL.<br/><em>DEIN UNIVERSUM.</em></h2>
    <p className={styles.description}>Spielzeit, Trophäen und persönliche Ziele. Ein Cockpit aus deinen vorhandenen PlayStation-Daten – ohne erfundene Sessions oder Statistiken.</p>
    <div className={styles.actions}>
     <button type="button" className={styles.primary} onClick={()=>goTo('psn-insights-fold')}>STATISTIKEN ÖFFNEN <span aria-hidden="true">↗</span></button>
     <button type="button" className={styles.secondary} onClick={()=>goTo('psn-game-editor')}>SPIELPLANER <span aria-hidden="true">→</span></button>
     <button type="button" className={styles.secondary} onClick={()=>goTo('psn-trophy-card-studio')}>COLLECTOR CARD <span aria-hidden="true">✦</span></button>
     <button type="button" className={styles.secondary} onClick={()=>goTo('psn-monitor-import')}>SESSION MONITOR <span aria-hidden="true">◉</span></button>
     <button type="button" className={styles.secondary} onClick={()=>goTo('psn-order-history-fold')}>KAUFHISTORIE <span aria-hidden="true">↗</span></button>
    </div>
   </div>
   <div className={styles.featured} aria-label="Zuletzt von PSN gemeldetes Spiel">
    <Picture game={top} className={styles.heroArt}/>
    <div className={styles.featuredShade}/>
    <div className={styles.featuredTop}><span>NOW IN YOUR WORLD</span><span className={styles.featuredNumber}>001 / PSN</span></div>
    <div className={styles.featuredCopy}>
     <small>{top?'ZULETZT GEMELDETES SPIEL':'NOCH KEINE PSN-SPIELE'}</small>
     <strong>{top?.name||top?.titleName||'Verbinde dein PSN-Profil'}</strong>
     <div><span>{displayHours(playDurationMinutes(top?.playDuration))} Gesamtspielzeit</span><span>{last?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(last)):'Kein letzter Spieltag'}</span></div>
    </div>
   </div>
  </div>
  <div className={styles.metrics} aria-label="PSN Kennzahlen">
   <div className={styles.metric}><small>01 / GESAMTSPIELZEIT</small><strong>{play.knownGames?displayHours(play.totalMinutes):'—'}</strong><span>{play.knownGames} Spiele mit Messwert</span></div>
   <div className={styles.metric}><small>02 / FREIGESCHALTET</small><strong>{trophy.trophySets?totalTrophies.toLocaleString('de-DE'):'—'}</strong><span>Trophäen aus {trophy.trophySets} Listen</span></div>
   <div className={styles.metric}><small>03 / PLATIN-SETS</small><strong>{trophy.trophySets?trophy.platinumSets.toLocaleString('de-DE'):'—'}</strong><span>Sony-gemeldete Platin-Trophäen</span></div>
   <div className={styles.metric}><small>04 / DEINE MISSIONEN</small><strong>{planned.toLocaleString('de-DE')}</strong><span>Spiele mit persönlichem Status</span></div>
  </div>
  <div className={styles.bottom}>
   <div className={styles.bottomLabel}><span>RECENTLY IN YOUR WORLD</span><small>Letztes bekanntes PSN-Datum je Titel · keine Sitzungsereignisse</small></div>
   <div className={styles.recent}>{featured.length?featured.slice(0,3).map((game,i)=><div className={styles.recentGame} key={game.titleId||i}>
    <Picture game={game} className={styles.thumb}/>
    <div><strong>{game.name||game.titleName}</strong><small>{lastPlayed(game)?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short'}).format(new Date(lastPlayed(game))):'Kein PSN-Datum'}</small></div>
   </div>):<p className={styles.noGames}>Sobald PSN-Spiele vorliegen, erscheinen sie hier.</p>}</div>
   <a className={styles.plusLink} href="/ps-plus">PS PLUS ATLAS <span aria-hidden="true">↗</span></a>
  </div>
 </section>;
}
