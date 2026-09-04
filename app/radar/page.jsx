import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import radar from '../../data/radar.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';

export const dynamic = 'force-dynamic';

function daysUntil(iso) {
  const end = new Date(iso);
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}
function StoryCard({ image, eyebrow, title, text, price, className = '' }) {
  return <article className={`mag-story ${className}`} style={{backgroundImage:`linear-gradient(180deg,rgba(3,8,18,.06),rgba(3,8,18,.91)),url("${image}")`}}><div className="mag-story-copy"><span className="mag-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p>{price?<strong className="mag-price">{price}</strong>:null}</div></article>;
}
function Panel({tone,icon,title,children,className=''}){return <section className={`mag-panel tone-${tone} ${className}`}><div className="mag-panel-head"><span className="mag-panel-icon">{icon}</span><h3>{title}</h3></div><div className="mag-panel-body">{children}</div></section>}
function PlusCover({game}){return <article className="plus-cover"><div className="plus-cover-art" style={{backgroundImage:`url("${game.image}")`}}></div><div className="plus-cover-copy"><strong>{game.title}</strong><small>PS PLUS · SEPTEMBER</small></div></article>}
function DealCard({deal}){return <article className="deal-card"><div className="deal-cover-art" style={{backgroundImage:`url("${deal.image}")`}}><span className="deal-discount">{deal.discount}</span></div><div className="deal-info"><strong>{deal.title}</strong><small>{deal.platform}</small><div className="deal-copy"><del>{deal.oldPrice}</del><b>{deal.price}</b></div></div></article>}

export default async function RadarPage(){const jar=await cookies();const expected=sessionToken();const actual=jar.get(COOKIE_NAME)?.value;if(!expected||!safeEqual(actual,expected))redirect('/');const remaining=daysUntil(radar.storeEnd);return <main className="mag-shell"><div className="mag-toolbar"><form action="/api/logout" method="post"><button className="logout">Abmelden</button></form></div><div className="magazine">
<header className="mag-masthead"><div className="mag-psmark">PS</div><div className="mag-brandblock"><div className="mag-brand">PLAYSTATION-RADAR</div><div className="mag-subbrand">NEWS MAGAZINE · DEUTSCHLAND</div></div><div className="mag-datebox"><strong>{radar.date}</strong><span>{radar.edition}</span></div></header>
<div className="mag-ticker"><strong>HEUTE NEU</strong><span>{radar.newHeadline}</span><b>{radar.newCount}</b></div>
<section className="mag-topgrid"><StoryCard className="mag-hero" image={radar.leadImage} eyebrow="TOP-NEWS · HEUTE ERSCHIENEN" title={radar.leadTitle} text={radar.leadMeta} price={radar.leadPrice}/><div className="mag-side-stack"><StoryCard image={radar.secondary1Image} eyebrow="RELEASE" title={radar.secondary1Title} text={radar.secondary1Meta} price={radar.secondary1Price}/><StoryCard image={radar.secondary2Image} eyebrow="SEIT GESTERN" title={radar.secondary2Title} text={radar.secondary2Meta} price={radar.secondary2Price}/></div></section>
<Panel tone="plus" icon="＋" title="PLAYSTATION PLUS · SEPTEMBER 2026" className="mag-plus"><div className="plus-summary compact-summary"><div><span>ESSENTIAL</span><h4>{radar.psplusTitle}</h4></div><p>{radar.psplusText}</p></div><div className="plus-covers">{radar.plusGames.map(game=><PlusCover key={game.title} game={game}/>)}</div></Panel>
<section className="mag-focusgrid"><Panel tone="danger" icon="⌛" title="ENDET BALD" className="compact-panel"><div className="deadline-row"><div><h4>{radar.leavingTitle}</h4><p>{radar.leavingText}</p></div><div className="mag-deadline">{remaining} {remaining===1?'TAG':'TAGE'}</div></div></Panel><Panel tone="store" icon="◆" title="STORE-DEALS" className="store-panel"><div className="store-intro"><div><h4>{radar.storeTitle}</h4><p>{radar.storeText}</p></div><span>bis 10.09.</span></div><div className="deal-grid">{radar.deals.map(deal=><DealCard key={deal.title} deal={deal}/>)}</div></Panel></section>
<section className="benefit-grid"><Panel tone="ea" icon="EA" title="EA PLAY"><p>{radar.benefitsText}</p><div className="ea-chip">FC 27 · 10h Trial ab 18.09.</div></Panel><Panel tone="ubi" icon="◎" title="UBISOFT+"><p>{radar.ubisoftText}</p><div className="ubi-list"><span>Assassin’s Creed</span><span>Far Cry</span><span>Watch Dogs</span></div></Panel></section>
<section className="mag-bottomgrid"><Panel tone="releases" icon="▦" title="KOMMENDE PS5-RELEASES"><div className="release-list">{radar.releases.map(item=><div key={`${item.date}-${item.title}`}><b>{item.date}</b><span>{item.title}</span></div>)}</div></Panel><Panel tone="quick" icon="✓" title="KURZ & KOMPAKT"><ul className="quick-list"><li>Onimusha und NBA 2K27 heute neu</li><li>PS Plus September-Spiele verfügbar</li><li>gamescom-Rabatte bis 10.09.</li><li>FC 27 Trial ab 18.09. über EA Play</li></ul></Panel></section>
<footer className="mag-footer"><span>PLAY HAS NO LIMITS.</span><small>{radar.radarCheck}</small></footer></div></main>}
