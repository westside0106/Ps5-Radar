'use client';
import {useEffect,useMemo,useState} from 'react';
import styles from './RegionalPriceComparison.module.css';

const money=(value,currency)=>{
 if(!Number.isFinite(value))return '—';
 try{return new Intl.NumberFormat('de-DE',{style:'currency',currency}).format(value)}
 catch{return '—'}
};
const lang={yes:'Englisch laut Quelle',no:'Englisch laut Quelle nicht enthalten',unknown:'Sprache unbekannt'};
const phase={concept:'Konzept-ID aus Store-Link',product:'Produkt-ID aus Store-Link',title:'Titelsuche'};
export default function RegionalPriceComparison({game,title}){
 const suggestedUrl=String(game?.metadata?.storeUrl||game?.storeUrl||'');
 const [link,setLink]=useState(suggestedUrl);
 const [result,setResult]=useState(null);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [discountOnly,setDiscountOnly]=useState(false);
 useEffect(()=>{setLink(suggestedUrl);setResult(null);setError('');setPending(false);setDiscountOnly(false)},[title,suggestedUrl]);
 async function compare(){
  if(pending||!title)return;
  setPending(true);setError('');setResult(null);
  try{
   const qs=new URLSearchParams({title});
   if(link.trim())qs.set('storeUrl',link.trim());
   const response=await fetch('/mein-playstation/api/region-prices?'+qs.toString(),{
    credentials:'same-origin',cache:'no-store'
   });
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Regionaldienst nicht erreichbar');
   setResult(json);
  }catch(e){setError(e.message||'Regionalvergleich fehlgeschlagen');}
  finally{setPending(false)}
 }
 const rows=useMemo(()=>Array.isArray(result?.rows)
  ?result.rows.filter(r=>!discountOnly||Number(r.discountPct)>0):[],[result,discountOnly]);
 const checked=Array.isArray(result?.rows)?result.rows.filter(r=>r.price!==null).length:0;
 return <section className={styles.root} aria-label={'Regionaler PlayStation Store-Preisvergleich für '+title}>
  <div className={styles.head}><div>
   <small>MULTI-REGION / COMMUNITY SERVICE</small>
   <h5>STORE-PREISE NACH REGION PRÜFEN</h5>
   <p>Deutschland, Großbritannien, USA und Polen. Preise bleiben in der jeweiligen Landeswährung; ein echter Kaufpreis hängt von Konto, Edition und Store-Region ab.</p>
  </div></div>
  <label className={styles.field}>Store-Link für die genaue Spielzuordnung (optional)
   <input value={link} onChange={e=>setLink(e.target.value)}
    placeholder="https://store.playstation.com/de-de/concept/..."
    autoComplete="off" inputMode="url" maxLength={320}/>
   <small>Ein offizieller Konzept-Link verbessert die Titelzuordnung. Ohne passenden Store-Link sucht der externe Dienst nach dem Titel und die Edition muss überprüft werden.</small>
  </label>
  <div className={styles.actions}>
   <button type="button" disabled={pending||title.length<3} onClick={compare}>
    {pending?'REGIONEN WERDEN ABGEFRAGT …':result?'REGIONEN ERNEUT PRÜFEN':'VIER REGIONEN VERGLEICHEN'}
   </button>
   <a href="https://github.com/imbbloh/ps-prices" target="_blank" rel="noopener noreferrer">Quellprojekt ansehen</a>
  </div>
  {pending?<p className={styles.info} role="status">Der externe Anbieter ermittelt Preise aus mehreren PlayStation-Stores. Der Dienst kann verzögert antworten oder zeitweise nicht erreichbar sein.</p>:null}
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {result?.status==='unavailable'||result?.status==='no-results'
   ?<p role="status" className={styles.info}>Keine belastbaren Regionaldaten erhalten. {result.reason||'Kein Ergebnis.'} Preise werden nicht geschätzt und die bestehenden Euro-Preisalarme bleiben unverändert.</p>:null}
  {result?.status==='provider-results'?<>
   <div className={styles.meta}>
    <span>Antwort: {result.title||title}</span>
    <span>{checked}/4 Regionen mit plausibler Preisangabe</span>
    <span>{result.observedAt?new Date(result.observedAt).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}):'Zeitstempel unbekannt'}</span>
    {result.providerCached?<span>Anbieter-/Servercache</span>:null}
   </div>
   <p className={styles.caution} role="note">Zuordnung: {phase[result.identityInput]||'Unbekannt'}. {result.match==='concept-id'
    ?'Konzept-ID übereinstimmend; angebotene Edition weiterhin prüfen.'
    :'Treffer nur anhand von Titel beziehungsweise Produktdaten; Edition und Region unbedingt im offiziellen Store prüfen.'}
    {' '}Die Preise stammen von einem <strong>Drittanbieter</strong> und wurden von PS5-Radar nicht unabhängig beim Kauf bestätigt.</p>
   <label className={styles.filter}><input type="checkbox" checked={discountOnly} onChange={e=>setDiscountOnly(e.target.checked)}/> Nur Regionen mit ausgewiesenem Preisnachlass anzeigen</label>
   <div className={styles.regions}>
    {rows.map(r=><article key={r.region} className={styles.region}>
     <div className={styles.rowHead}><strong>{r.label}</strong><span>{r.region} · {r.currency}</span></div>
     {r.price!==null?<><b className={styles.price}>{money(r.price,r.currency)}</b>
      {Number.isFinite(r.original)&&r.discountPct>0?<p className={styles.discount}><s>{money(r.original,r.currency)}</s><strong>−{r.discountPct} %</strong></p>:null}
      <small>{r.sourceMode==='concept'?'Konzeptseite':r.sourceMode==='product'?'Produktseite':'Store-Suche'} · {lang[r.english]||'Sprache unbekannt'}</small>
      {r.editionsCount>1?<small>{r.editionsCount} erkannte Preisvarianten: angezeigter Betrag kann eine andere Edition betreffen</small>:null}
     </>:<p className={styles.missing}>Kein belastbarer Preis – {r.suspicious?'abweichende oder auffällige Daten':'nicht bestätigt'}.</p>}
     {r.link?<a href={r.link} target="_blank" rel="noopener noreferrer">IM {r.region}-STORE PRÜFEN</a>:null}
    </article>)}
   </div>
   {rows.length===0?<p className={styles.info}>Keine Regionen mit ausgewiesenem Rabatt. Deaktiviere den Filter, um alle Regionen zu sehen.</p>:null}
  </>:null}
  <p className={styles.disclaimer}>Keine Währungsumrechnung und keine automatische Bestpreis-Rangfolge. Ein Preis aus einem anderen Land ist nicht automatisch mit einem deutschen PSN-Konto kaufbar. PS5-Radar übernimmt diese Fremdpreise <strong>nicht</strong> in seine EUR-Preisalarme.</p>
 </section>;
}
