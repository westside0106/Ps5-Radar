import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {COOKIE_NAME,safeEqual,sessionToken} from '../auth';
import {getPsnDashboard} from '../../lib/psn-server.mjs';
import './style.css';
export const dynamic='force-dynamic';
export const metadata={title:'Mein PlayStation · PS5 Radar',robots:{index:false,follow:false}};
function hours(value){const n=Number(value);return Number.isFinite(n)?Math.round(n/60)+' Std.':'—';}
export default async function MyPlayStation({searchParams}){
 const jar=await cookies(), expected=sessionToken();
 if(!expected||!safeEqual(jar.get(COOKIE_NAME)?.value,expected))redirect('/');
 let data;try{data=await getPsnDashboard();}catch(e){data={connected:false,configured:true,error:e.message};}
 const params=await searchParams; const over50=params?.filter==='over50';
 const titles=(data?.trophies?.trophyTitles||[]).filter(g=>!over50||Number(g.progress)>50);
 const played=data?.played?.titles||[];
 const summary=data?.summary||{};
 const counts=summary.earnedTrophies||{};
 return <main className="psn-shell">
 <nav className="psn-nav"><Link href="/radar">← Radar</Link><Link href="/ps-plus">PS+ Katalog</Link></nav>
 <header><span className="psn-eyebrow">PRIVATE · PLAYSTATION NETWORK</span><h1>Mein PlayStation</h1><p>Deine Spielaktivität und Trophäen – ausschließlich für deinen geschützten Radar.</p></header>
 {!data.configured?<section className="psn-panel"><h2>Verbindung vorbereiten</h2><p>Die PSN-Anbindung ist implementiert, aber noch nicht mit deinem Konto verbunden. Hinterlege den NPSSO ausschließlich als geheime Vercel-Umgebungsvariable <code>PSN_NPSSO</code>. Niemals in GitHub oder im Chat veröffentlichen.</p><p>Nach einem neuen Deployment lädt diese Seite deine Daten automatisch.</p></section>:null}
 {data.error?<section className="psn-panel" role="alert"><h2>PSN-Verbindung fehlgeschlagen</h2><p>{data.error}</p></section>:null}
 {data.connected?<><section className="psn-stats">
 <div><span>Trophäenlevel</span><strong>{summary.trophyLevel??'—'}</strong></div>
 <div><span>Platin</span><strong>{counts.platinum??'—'}</strong></div>
 <div><span>Gold</span><strong>{counts.gold??'—'}</strong></div>
 <div><span>Silber</span><strong>{counts.silver??'—'}</strong></div>
 <div><span>Bronze</span><strong>{counts.bronze??'—'}</strong></div>
 </section>
 {data.errors?.length?<p className="psn-warning">Einzelne Bereiche konnten nicht geladen werden: {data.errors.join(' · ')}</p>:null}
 <section className="psn-panel"><h2>Zuletzt gespielt</h2><div className="psn-games">{played.length?played.slice(0,36).map((game,i)=><article key={game.titleId||i}><strong>{game.name||game.titleName||'Unbekanntes Spiel'}</strong><span>{hours(game.playDuration)}{game.lastPlayedDateTime?' · Zuletzt '+new Date(game.lastPlayedDateTime).toLocaleDateString('de-DE'):''}</span></article>):<p>Keine Spielaktivität verfügbar oder durch Privatsphäre-Einstellungen eingeschränkt.</p>}</div></section>
 <section className="psn-panel"><h2>Trophäenfortschritt</h2><div className="psn-filter"><Link href="/mein-playstation">Alle Spiele</Link><Link href="/mein-playstation?filter=over50">Über 50 %</Link></div><div className="psn-games">{titles.length?titles.map((game,i)=><article key={game.npCommunicationId||i}><strong>{game.trophyTitleName||'Unbekanntes Spiel'}</strong><span>{game.progress??0}% · {game.earnedTrophies?.platinum??0} Platin · {game.earnedTrophies?.gold??0} Gold</span><div className="psn-progress"><i style={{width:Math.max(0,Math.min(100,Number(game.progress)||0))+'%'}}/></div></article>):<p>Keine Trophäenliste verfügbar.</p>}</div></section>
 <p className="psn-foot">Synchronisiert: {new Date(data.checkedAt).toLocaleString('de-DE')} · Nur lesender Zugriff · Inoffizielle PSN-Schnittstelle</p></>:null}
 </main>;
}
