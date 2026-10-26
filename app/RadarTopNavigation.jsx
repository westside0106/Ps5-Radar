'use client';
import {usePathname} from 'next/navigation';
import {useEffect,useRef} from 'react';

const links=[
 {href:'/radar',label:'PlayStation',short:'PS',match:path=>path==='/radar'},
 {href:'/xbox',label:'Xbox',short:'Xbox',beta:true,match:path=>path.startsWith('/xbox')},
 {href:'/ps-plus',label:'PS+ Katalog',short:'PS+',match:path=>path.startsWith('/ps-plus')},
 {href:'/preise',label:'Preisradar',short:'Preise',match:path=>path.startsWith('/preise')},
 {href:'/zentrale',label:'Radar-Zentrale',short:'Zentrale',match:path=>path.startsWith('/zentrale')},
 {href:'/archive',label:'Archiv',short:'Archiv',match:path=>path.startsWith('/archive')},
 {href:'/mein-playstation?view=games',label:'Meine Spielwelt',short:'Spielwelt',personal:true,match:path=>path.startsWith('/mein-playstation')}
];
export default function RadarTopNavigation(){
 const path=usePathname()||'/';
 const navRef=useRef(null);
 useEffect(()=>{
  const onKey=e=>{
   if(!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=='k')return;
   if(e.altKey||e.shiftKey)return;
   e.preventDefault();
   window.location.assign('/zentrale?tab=suche');
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[]);
 useEffect(()=>{
  const nav=navRef.current,active=nav?.querySelector('[aria-current="page"]');
  if(!nav||!active)return;
  const left=active.offsetLeft-nav.offsetLeft-(nav.clientWidth-active.clientWidth)/2;
  nav.scrollLeft=Math.max(0,left);
 },[path]);
 if(path==='/'||path.startsWith('/api/')||path.startsWith('/daily/'))return null;
 return <header className="radar-global-navigation">
  <div className="radar-global-navigation-inner">
   <a href="/radar" className="radar-global-brand" aria-label="PlayStation Radar – Startseite">
    <span className="radar-brand-symbol" aria-hidden="true">R</span>
    <span className="radar-brand-text"><strong>RADAR</strong><small>GAMING INTELLIGENCE</small></span>
   </a>
   <nav ref={navRef} className="radar-global-links" aria-label="Hauptnavigation">
    {links.map(item=><a key={item.href} href={item.href} className={'radar-global-link'+(item.match(path)?' is-current':'')+(item.personal?' is-personal':'')} aria-current={item.match(path)?'page':undefined}>
     <span className="radar-link-long">{item.label}</span>
     <span className="radar-link-short">{item.short}</span>
     {item.beta?<small className="radar-link-beta">BETA</small>:null}
    </a>)}
   </nav>
  </div>
 </header>;
}
