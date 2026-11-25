'use client';
import {useMemo,useState} from 'react';
import styles from './RegionalPriceHistory.module.css';

const regions=[
 {value:'DE',label:'Deutschland',currency:'EUR'},
 {value:'GB',label:'Großbritannien',currency:'GBP'},
 {value:'US',label:'USA',currency:'USD'},
 {value:'PL',label:'Polen',currency:'PLN'}
];
const money=(price,currency)=>new Intl.NumberFormat('de-DE',{
 style:'currency',currency,maximumFractionDigits:2
}).format(price);
const width=540,height=152,padX=32,padY=20;
export default function RegionalPriceHistory({history}){
 const [region,setRegion]=useState('DE');
 const [days,setDays]=useState(30);
 const selected=regions.find(x=>x.value===region)||regions[0];
 const rows=useMemo(()=>{
  const end=new Date(),cut=Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate())
   -(days-1)*86400000;
  return (history?.points||[]).filter(p=>p?.region===region
   &&Number.isFinite(p.price)&&Number.isFinite(Date.parse(p.day+'T00:00:00Z'))
   &&Date.parse(p.day+'T00:00:00Z')>=cut)
   .sort((a,b)=>a.day.localeCompare(b.day));
 },[history,region,days]);
 const values=rows.map(x=>x.price),low=values.length?Math.min(...values):null,
  high=values.length?Math.max(...values):null;
 const last=rows.at(-1),first=rows[0];
 const plotted=useMemo(()=>{
  if(!rows.length)return [];
  const end=Date.now(),start=end-(days-1)*86400000;
  const min=Math.min(...rows.map(r=>r.price)),max=Math.max(...rows.map(r=>r.price));
  const span=Math.max(0.01,max-min);
  return rows.map(p=>{
   const unix=Date.parse(p.day+'T12:00:00Z');
   return {day:p.day,price:p.price,
    x:Math.max(padX,Math.min(width-padX,padX+(unix-start)/(end-start)*(width-2*padX))),
    y:padY+(max-p.price)/span*(height-2*padY)
   };
  });
 },[rows,days]);
 if(!history)return null;
 return <section className={styles.root} aria-label="Privater Regionalpreisverlauf">
  <div className={styles.header}>
   <div><small>PRIVATE PRICE EVIDENCE</small><h6>GESPEICHERTER REGIONALVERLAUF</h6>
    <p>Beobachtete Drittanbieterpreise an einzelnen Tagen, kein kontinuierlicher Sony-Preisticker.</p>
   </div>
   <div className={styles.controls}>
    <select aria-label="Region für Preisverlauf" value={region} onChange={e=>setRegion(e.target.value)}>
     {regions.map(x=><option value={x.value} key={x.value}>{x.label} ({x.currency})</option>)}
    </select>
    <div role="group" aria-label="Historienzeitraum">
     {[7,30,90].map(x=><button type="button" key={x} aria-pressed={days===x}
      className={days===x?styles.current:''} onClick={()=>setDays(x)}>{x}T</button>)}
    </div>
   </div>
  </div>
  {rows.length?<><div className={styles.metrics}>
   <div><span>Letzte Beobachtung</span><strong>{money(last.price,selected.currency)}</strong><small>{last.day}</small></div>
   <div><span>Niedrigster Messpunkt</span><strong>{money(low,selected.currency)}</strong></div>
   <div><span>Höchster Messpunkt</span><strong>{money(high,selected.currency)}</strong></div>
   <div><span>Beobachtete Tage</span><strong>{rows.length}</strong><small>von {days} Tagen</small></div>
  </div>
  <div className={styles.chart}>
   <svg viewBox={`0 0 ${width} ${height}`} role="img"
    aria-label={`${rows.length} einzelne Preisbeobachtungen in ${selected.currency}, von ${money(low,selected.currency)} bis ${money(high,selected.currency)}`}>
    <line x1={padX} y1={height-padY} x2={width-padX} y2={height-padY} stroke="#789eb1" strokeWidth="1"/>
    <line x1={padX} y1={padY} x2={padX} y2={height-padY} stroke="#456b80" strokeWidth="1"/>
    {plotted.map((point,i)=><g key={point.day}>
     <line x1={point.x} y1={height-padY} x2={point.x} y2={point.y}
      stroke="#63b9a9" strokeWidth="1" opacity=".4"/>
     <circle cx={point.x} cy={point.y} r="4" fill="#adf2cf" stroke="#193e51" strokeWidth="1">
      <title>{point.day}: {money(point.price,selected.currency)}</title>
     </circle>
    </g>)}
   </svg>
   <div className={styles.axis}><span>{first.day}</span><span>{last.day}</span></div>
  </div>
  <div className={styles.recent}><strong>Letzte Messpunkte</strong><div>
   {rows.slice(-5).reverse().map(x=><span key={x.day}>{x.day}: <b>{money(x.price,selected.currency)}</b></span>)}
  </div></div>
  </>:<p role="status" className={styles.empty}>Für {selected.label} gibt es in den vergangenen {days} Tagen noch keine gespeicherte Preisbeobachtung. Fehlende Tage werden nicht als Preisänderung gewertet.</p>}
  <p className={styles.note}>Quelle: {history.source||'imbbloh/ps-prices'} · Private Tagesbeobachtungen, keine verifizierten Kaufpreise. Der niedrigste archivierte Messpunkt ist kein nachgewiesenes historisches Allzeittief. Währungen, Editionen und Kontoberechtigung bleiben getrennt; diese Daten lösen keine EUR-Preisalarme aus.</p>
 </section>;
}
