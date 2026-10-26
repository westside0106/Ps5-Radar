import {chartPoints,summarizePriceHistory} from '../../lib/price-radar-insights.mjs';
const euro=n=>Number.isFinite(n)?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n):'—';
export default function PriceTrend({points=[],title,signal}){
 const info=summarizePriceHistory(points),path=chartPoints(points);
 if(!info.count)return null;
 const active=Boolean(signal?.activeDeal&&Number.isFinite(signal?.currentPrice));
 return <section className="price-analysis" aria-label={'Preis-Analyse für '+title}>
  <div className="price-analysis-head"><strong>Radar-Preishistorie</strong><span>{info.count} {info.count===1?'Messpunkt':'Messpunkte'}</span></div>
  {info.count>1?<svg viewBox="0 0 320 118" className="price-analysis-chart" role="img" aria-label={'Historischer Preistrend von '+title+', '+info.count+' erfasste Tagespunkte'} preserveAspectRatio="none">
   <line x1="8" y1="105" x2="312" y2="105" stroke="#4b789d" strokeWidth="1"/>
   <polyline points={chartPoints(info.points,304,85).split(' ').map(v=>{const [x,y]=v.split(',');return (8+Number(x))+','+(10+Number(y))}).join(' ')} fill="none" stroke="#79cbff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
   </svg>:<p className="price-analysis-unknown">Nur eine Preisbeobachtung – für einen Verlauf fehlen weitere Messungen.</p>}
  <div className="price-analysis-values">
   <div><small>Erster Radar-Preis</small><strong>{euro(info.first?.price)}</strong></div>
   <div><small>Radar-Tiefstwert</small><strong>{euro(info.low)}</strong></div>
   <div><small>Zuletzt beobachtet</small><strong>{euro(info.last?.price)}</strong></div>
  </div>
  {info.change!==null&&info.count>=2?<p className="price-analysis-note">Preisänderung seit erster erfasster Messung: {info.change>0?'+':''}{info.change.toLocaleString('de-DE',{maximumFractionDigits:1})} %. Keine externe Preisvergleichsstatistik.</p>:null}
  <p className="price-analysis-note">{active?'Ein aktuell verifizierter Store-Deal ist vorhanden.':'Der letzte Messpunkt ist historisch und kein aktuelles Kaufangebot.'} Die Werte stammen ausschließlich aus Radar-Ausgaben.</p>
 </section>;
}
