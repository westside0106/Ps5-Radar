'use client';
import {useMemo,useState} from 'react';
import {parseOrderHistory,summarizeOrderHistory} from '../../lib/psn-order-history.mjs';
import styles from './OrderHistoryIntelligence.module.css';

const names={purchased:'Gekauft',psplus:'PS Plus',free:'Kostenlos',subscription:'Abonnements',voucher:'Gutscheine',other:'Sonstige'};
const money=(value,currency)=>new Intl.NumberFormat('de-DE',{style:'currency',currency,maximumFractionDigits:2}).format(value??0);
const date=v=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z'));
export default function OrderHistoryIntelligence(){
 const [loaded,setLoaded]=useState(null);
 const [currency,setCurrency]=useState('EUR');
 const [category,setCategory]=useState('all');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const stats=useMemo(()=>loaded?summarizeOrderHistory(loaded.rows):null,[loaded]);
 const visible=useMemo(()=>loaded?[...loaded.rows].filter(r=>category==='all'||r.category===category).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,18):[],[loaded,category]);
 const top=Math.max(1,...(stats?.monthly||[]).map(x=>x.paid));
 async function onFile(e){
  const file=e.target.files?.[0];
  e.target.value='';
  if(!file)return;
  if(file.size>3_000_000){setMessage('Die Datei ist größer als 3 MB.');return}
  if(!/\.(json|csv)$/i.test(file.name)){setMessage('Nur originale CSV- oder JSON-Exporte von PS Order History+ werden unterstützt.');return}
  setBusy(true);setMessage('');
  try{
   const text=await file.text();
   const result=parseOrderHistory(text,file.name.toLowerCase().endsWith('.json')?'json':'csv');
   setLoaded(result);setCategory('all');
   setMessage(result.rows.length+' Positionen im Browser eingelesen. '+(result.skippedRows?result.skippedRows+' ungültige oder doppelte Einträge ausgelassen.':'Keine Einträge verworfen.'));
  }catch(error){setMessage(String(error?.message||'Datei konnte nicht verarbeitet werden.'))}
  finally{setBusy(false)}
 }
 return <section className={styles.root} aria-label="PlayStation-Kaufhistorie und Ausgabenanalyse">
  <div className={styles.head}>
   <div><span className={styles.kicker}>FINANCIAL TELEMETRY // ORDER INTELLIGENCE</span><h4>DEINE SPIELE.<br/><em>DEINE KAUFHISTORIE.</em></h4>
    <p>Was wurde gekauft, was nur über PS Plus eingelöst? Importiere den Export von <a href="https://github.com/HeyProtagonist/ps-orders-plus" target="_blank" rel="noopener noreferrer">PS Order History+</a> und analysiere ihn ohne neue PSN-Anmeldung.</p>
   </div><span className={styles.security}>LOKAL · KEIN UPLOAD</span>
  </div>
  <div className={styles.tools}>
   <label className={styles.fileInput}><span>CSV / JSON IMPORTIEREN</span><input type="file" accept=".csv,.json,text/csv,application/json" onChange={onFile} disabled={busy}/></label>
   <label className={styles.currency}>Währung für diesen Export<select value={currency} onChange={e=>setCurrency(e.target.value)}><option value="EUR">EUR (€)</option><option value="USD">USD ($)</option><option value="GBP">GBP (£)</option></select></label>
   {loaded?<button type="button" className={styles.clear} onClick={()=>{setLoaded(null);setCategory('all');setMessage('Importdaten aus dieser Ansicht gelöscht.');}}>DATEN VERWERFEN</button>:null}
  </div>
  <p className={styles.disclaimer}><strong>Datenschutz:</strong> Die Datei wird ausschließlich im Arbeitsspeicher dieses Browser-Tabs verarbeitet, nicht in Supabase, localStorage oder auf dem Server gespeichert. Die Währung ist im CSV-Export nicht enthalten und muss zum Export passen. Bei gemischten Store-Währungen keine Gesamtsumme verwenden.</p>
  {message?<p role="status" className={styles.message}>{message}</p>:null}
  {stats?<div className={styles.loaded}>
   <div className={styles.metrics}>
    <div><small>ERFASSTE AUSGABEN</small><strong>{money(stats.netSpent,currency)}</strong><span>Nur importierte Positionen, abzüglich vollständig erstatteter Käufe</span></div>
    <div><small>DIREKT GEKAUFT</small><strong>{stats.groups.purchased.count}</strong><span>{money(stats.groups.purchased.paid,currency)} im Export</span></div>
    <div><small>PS PLUS EINLÖSUNGEN</small><strong>{stats.groups.psplus.count}</strong><span>Teilweise heuristisch zugeordnet</span></div>
    <div><small>ABONNEMENT-POSTEN</small><strong>{stats.groups.subscription.count}</strong><span>{money(stats.groups.subscription.paid,currency)} im Export</span></div>
   </div>
   <div className={styles.columns}>
    <div className={styles.panel}><div className={styles.panelTitle}><h5>AUSGABENVERLAUF</h5><span>Letzte 18 erfasste Monate</span></div>
     {stats.monthly.length?<div className={styles.chart}>{stats.monthly.map(m=><div key={m.month} className={styles.barLine}>
      <span>{m.month.slice(5)}.{m.month.slice(0,4)}</span><div className={styles.track}><i style={{width:(m.paid/top*100)+'%'}}/></div><strong>{money(m.paid,currency)}</strong>
     </div>)}</div>:<p>Keine datierten Transaktionen.</p>}
     <p className={styles.footnote}>Unvollständige oder gefilterte Exporte ergeben unvollständige Monatswerte. Keine automatische Live-Synchronisierung.</p>
    </div>
    <div className={styles.panel}><div className={styles.panelTitle}><h5>BESTELLKLASSEN</h5><span>{stats.positions} importierte Positionen</span></div>
     <div className={styles.classes}>{Object.entries(names).map(([key,title])=><button key={key} type="button" aria-pressed={category===key} onClick={()=>setCategory(category===key?'all':key)}>
      <span><i className={styles.bullet} aria-hidden="true"/>{title}</span><strong>{stats.groups[key].count}</strong>
     </button>)}</div>
     <p className={styles.footnote}>Der PS-Plus-Status wird von der Browser-Erweiterung teilweise geschätzt. Ein früherer Store-Listenpreis ist keine nachgewiesene Ersparnis.</p>
    </div>
   </div>
   <div className={styles.transactions}>
    <div className={styles.panelTitle}><h5>BESTELLPOSITIONEN</h5><div><span>{category==='all'?'Alle Kategorien':names[category]} · {visible.length} sichtbar</span>{category!=='all'?<button type="button" onClick={()=>setCategory('all')}>Filter zurücksetzen</button>:null}</div></div>
    <div className={styles.entries}>{visible.length?visible.map((item,index)=><article key={item.date+'|'+item.title+'|'+index}>
     <span className={styles.entryIndex}>{String(index+1).padStart(2,'0')}</span>
     <div className={styles.entryName}><strong>{item.title}</strong><small>{date(item.date)} · {names[item.category]}{item.refunded?' · Erstattet':''}</small></div>
     <strong className={styles.entryPrice}>{item.refunded?'Erstattet':item.paid===null?'Betrag unbekannt':money(item.paid,currency)}</strong>
    </article>):<p>Keine Positionen für diese Kategorie.</p>}</div>
    {loaded.rows.length>visible.length?<p className={styles.footnote}>Es werden maximal 18 Positionen angezeigt. Alle gültigen Zeilen fließen in die Auswertung ein.</p>:null}
   </div>
   {stats.unknownAmounts>0?<p className={styles.warning}>{stats.unknownAmounts} Positionen ohne gültigen Geldbetrag wurden nicht als Ausgaben gezählt.</p>:null}
  </div>:<div className={styles.empty}><span aria-hidden="true">◎</span><div><strong>DEIN EINKAUFSARCHIV WARTET.</strong><small>Original-Export in Chrome/Edge erzeugen, hier auf iPhone oder Desktop importieren. Keine Daten bleiben nach dem Schließen oder Neuladen dieser Seite gespeichert.</small></div></div>}
 </section>;
}
