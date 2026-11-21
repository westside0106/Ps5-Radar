'use client';
import {useMemo,useState} from 'react';
import styles from './TrophyCardStudio.module.css';

const THEMES={
  aurora:{name:'AURORA',base:'#060e24',light:'#91eaff',accent:'#5276ff',secondary:'#cbabff',ink:'#ecfbff'},
  obsidian:{name:'OBSIDIAN',base:'#0b1018',light:'#e6eefb',accent:'#7e94b6',secondary:'#b3c3d8',ink:'#f6faff'},
  gold:{name:'GOLD EDITION',base:'#1b1009',light:'#ffdf8f',accent:'#b77b35',secondary:'#ffd099',ink:'#fff1d7'},
};
const count=(t,type)=>Math.max(0,Math.floor(Number(t?.earnedTrophies?.[type])||0));
const progress=t=>t?.progress===null||t?.progress===undefined||t?.progress===''?null:(Number.isFinite(Number(t.progress))&&Number(t.progress)>=0&&Number(t.progress)<=100?Number(t.progress):null);
const xml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function cutLines(raw,max=23){
 const words=String(raw||'UNKNOWN GAME').replace(/\s+/g,' ').trim().split(' ');
 const lines=[];let buffer='';
 for(const word of words){
  if((buffer?buffer.length+1:0)+word.length>max&&buffer){lines.push(buffer);buffer='';}
  if(word.length>max){if(buffer)lines.push(buffer);lines.push(word.slice(0,max));buffer='';}
  else buffer=buffer?buffer+' '+word:word;
 }
 if(buffer)lines.push(buffer);
 if(lines.length>3){const keep=lines.slice(0,3);keep[2]=keep[2].slice(0,Math.max(1,max-1))+'…';return keep;}
 return lines.length?lines:['UNKNOWN GAME'];
}
function downloadSvg(item,theme){
 const title=String(item.trophyTitleName||'Unbekanntes Spiel');
 const id=String(item.npCommunicationId||'');
 const themeColor=THEMES[theme]||THEMES.aurora;
 const pct=progress(item);
 const earned=['bronze','silver','gold','platinum'].reduce((n,k)=>n+count(item,k),0);
 const platinum=count(item,'platinum')>0;
 const lines=cutLines(title).map((line,i)=>`<text x="92" y="${565+i*86}" font-size="${line.length>21?53:67}" font-weight="900" letter-spacing="-2" fill="#fff">${xml(line)}</text>`).join('');
 const status=platinum?'PLATINUM UNLOCKED':pct===100?'100% TROPHY PROGRESS':pct===null?'PROGRESS UNKNOWN':'TROPHY HUNTER';
 const percentage=pct===null?'—':pct+'%';
 const safeId=xml(id.slice(0,60));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600" role="img" aria-label="${xml(title)} personal PSN trophy card">
 <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${themeColor.base}"/><stop offset=".53" stop-color="${themeColor.accent}"/><stop offset="1" stop-color="${themeColor.base}"/></linearGradient>
 <linearGradient id="metal" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="${themeColor.ink}"/><stop offset=".48" stop-color="${themeColor.light}"/><stop offset="1" stop-color="${themeColor.secondary}"/></linearGradient>
 <radialGradient id="halo"><stop stop-color="${themeColor.light}" stop-opacity=".5"/><stop offset="1" stop-color="${themeColor.light}" stop-opacity="0"/></radialGradient>
 <pattern id="grid" width="58" height="58" patternUnits="userSpaceOnUse"><path d="M58 0H0V58" fill="none" stroke="#fff" stroke-opacity=".075" stroke-width="1"/></pattern></defs>
 <rect width="1200" height="1600" fill="url(#bg)"/><rect width="1200" height="1600" fill="#040914" opacity=".5"/><circle cx="900" cy="440" r="590" fill="url(#halo)"/>
 <path d="M1300 50 L200 1350 M1370 190 L400 1500 M1120 -50 L-80 1280" stroke="${themeColor.light}" stroke-opacity=".16" stroke-width="4"/>
 <rect x="46" y="46" width="1108" height="1508" rx="35" fill="none" stroke="${themeColor.light}" stroke-opacity=".7" stroke-width="3"/>
 <rect x="68" y="68" width="1064" height="1464" rx="21" fill="url(#grid)" stroke="#fff" stroke-opacity=".2" stroke-width="1"/>
 <text x="92" y="157" fill="${themeColor.light}" font-size="28" letter-spacing="8" font-weight="800">PLAYSTATION RADAR</text>
 <text x="1090" y="157" fill="#fff" font-size="28" text-anchor="end" font-weight="700">01 / COLLECTORS EDITION</text>
 <path d="M92 188H1108" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
 <circle cx="600" cy="344" r="138" fill="none" stroke="url(#metal)" stroke-width="10"/><circle cx="600" cy="344" r="117" fill="none" stroke="${themeColor.light}" stroke-opacity=".4" stroke-width="2"/>
 <path d="M530 350H670L655 308H545Z M600 304V420 M548 416H652" fill="none" stroke="url(#metal)" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
 <path d="M557 314L600 268L643 314" fill="none" stroke="url(#metal)" stroke-width="13" stroke-linecap="round"/>
 <text x="92" y="484" font-size="26" font-weight="800" letter-spacing="7" fill="${themeColor.light}">PERSONAL TROPHY RECORD</text>
 ${lines}
 <rect x="92" y="868" width="1015" height="120" rx="18" fill="#000" fill-opacity=".31" stroke="${themeColor.light}" stroke-opacity=".55" stroke-width="2"/>
 <text x="123" y="913" font-size="24" letter-spacing="4" fill="${themeColor.light}">STATUS</text><text x="123" y="961" font-size="46" font-weight="900" fill="#fff">${xml(status)}</text>
 <text x="92" y="1080" font-size="27" letter-spacing="5" fill="${themeColor.light}">TROPHY PROGRESS</text>
 <text x="1090" y="1122" font-size="89" font-weight="900" text-anchor="end" fill="#fff">${xml(percentage)}</text>
 <rect x="92" y="1160" width="1015" height="20" rx="10" fill="#fff" fill-opacity=".17"/><rect x="92" y="1160" width="${pct===null?0:Math.round(1015*pct/100)}" height="20" rx="10" fill="url(#metal)"/>
 <path d="M92 1235H1107" stroke="#fff" stroke-opacity=".3" stroke-width="2"/>
 <text x="92" y="1305" font-size="31" fill="#fff" font-weight="700">BRONZE  ${count(item,'bronze')}</text><text x="670" y="1305" font-size="31" fill="#fff" font-weight="700">SILBER  ${count(item,'silver')}</text>
 <text x="92" y="1367" font-size="31" fill="#fff" font-weight="700">GOLD  ${count(item,'gold')}</text><text x="670" y="1367" font-size="31" fill="#fff" font-weight="700">PLATIN  ${count(item,'platinum')}</text>
 <text x="92" y="1461" font-size="24" fill="${themeColor.light}" letter-spacing="3">PSN EARNED  ${earned}  ·  ${safeId}</text>
 <text x="1090" y="1506" font-size="24" text-anchor="end" fill="#fff" fill-opacity=".7">PRIVATE FAN CARD / ${themeColor.name}</text>
 </svg>`;
 const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 const filename=title.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'game';
 a.href=url;a.download='PS5-Radar-'+filename+'-Trophy-Card.svg';
 document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),2500);
}
export default function TrophyCardStudio({titles=[]}){
 const options=useMemo(()=>Array.isArray(titles)?[...new Map(titles.filter(t=>t?.npCommunicationId).map(t=>[String(t.npCommunicationId),t])).values()].sort((a,b)=>count(b,'platinum')-count(a,'platinum')||Number(b.progress||0)-Number(a.progress||0)||(a.trophyTitleName||'').localeCompare(b.trophyTitleName||'','de')):[],[titles]);
 const [id,setId]=useState('');
 const [foil,setFoil]=useState('aurora');
 const current=options.find(x=>x.npCommunicationId===id)||options[0]||null;
 const theme=THEMES[foil];
 const pct=current?progress(current):null;
 const earned=current?['bronze','silver','gold','platinum'].reduce((n,k)=>n+count(current,k),0):0;
 const platinum=current?count(current,'platinum')>0:false;
 return <section className={styles.studio} aria-label="Trophy Collector Card Studio">
  <div className={styles.info}>
   <span className={styles.kicker}>COLLECTOR SERIES // VOL. 001</span>
   <h4>DEINE ERFOLGE.<br/><em>DEINE SAMMLERKARTE.</em></h4>
   <p>Ein eigener, hochauflösender Trophäen-Print. Jede Karte enthält ausschließlich Werte aus deinen PSN-Trophäenlisten. Kein erfundener Platin-Status.</p>
   <label className={styles.field}>Trophäenliste
    <select value={current?.npCommunicationId||''} onChange={e=>setId(e.target.value)} disabled={!options.length}>
     {options.length?options.map(t=><option key={t.npCommunicationId} value={t.npCommunicationId}>{t.trophyTitleName||t.npCommunicationId}</option>):<option value="">Keine PSN-Trophäenlisten</option>}
    </select>
   </label>
   <fieldset className={styles.foils}><legend>FINISH / FOIL</legend>
    {Object.entries(THEMES).map(([key,t])=><button key={key} type="button" aria-pressed={foil===key} className={foil===key?styles.active:''} onClick={()=>setFoil(key)}><span style={{background:t.light}} aria-hidden="true"/>{t.name}</button>)}
   </fieldset>
   <button type="button" className={styles.download} disabled={!current} onClick={()=>downloadSvg(current,foil)}>KARTE ALS SVG EXPORTIEREN <span aria-hidden="true">↗</span></button>
   <small className={styles.disclaimer}>Originalgestaltung · 1200 × 1600 Pixel · SVG ist verlustfrei skalierbar · Export nur nach deinem Klick.</small>
  </div>
  <div className={styles.stage}>
   <div className={styles.card} style={{'--foil':theme.light,'--glow':theme.accent,'--base':theme.base,'--secondary':theme.secondary}}>
    <div className={styles.cardTop}><span>PLAYSTATION RADAR</span><span>001 / COLLECTOR</span></div>
    <div className={styles.crest} aria-hidden="true"><svg viewBox="0 0 120 120" width="98" height="98" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M60 21v76 M32 32v27c0 20 14 31 28 31s28-11 28-31V32 M21 32l11-15 11 15 M49 21 60 7 71 21 M77 32l11-15 11 15 M45 101h30 M52 92v9 M68 92v9"/></svg></div>
    <div className={styles.cardMiddle}><small>PERSONAL TROPHY RECORD</small><strong>{current?.trophyTitleName||'DEINE TROPHY CARD'}</strong></div>
    <div className={styles.cardStatus}>{platinum?'PLATIN FREIGESCHALTET':pct===100?'100 % TROPHÄENFORTSCHRITT':pct===null?'FORTSCHRITT UNBEKANNT':'TROPHY HUNTER'}</div>
    <div className={styles.cardBottom}><div><small>TROPHY PROGRESS</small><strong>{pct===null?'—':pct+'%'}</strong></div><div className={styles.progressRail}><span style={{width:(pct??0)+'%'}}/></div>
     <div className={styles.cardCount}><span>BR {count(current,'bronze')}</span><span>SI {count(current,'silver')}</span><span>GO {count(current,'gold')}</span><span>PL {count(current,'platinum')}</span></div>
     <div className={styles.cardFooter}><span>{earned} EARNED</span><span>{theme.name} / PSN</span></div>
    </div>
   </div>
  </div>
 </section>;
}
