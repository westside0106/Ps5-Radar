import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import radar from '../../data/radar.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import ScaleCanvas from './ScaleCanvas';

export const dynamic = 'force-dynamic';

function Card({ eyebrow, title, text, price, prominent=false, lead=false, badge=false }) {
  return <article className={`card ${lead?'lead ':''}${prominent?'module prominent':'module'}`}><div className="inner"><div><div className="eyebrow">{eyebrow}</div>{lead?<h2>{title}</h2>:<h3>{title}</h3>}{text?<div className={lead?'meta':''}>{lead?text:<p>{text}</p>}</div>:null}{price?<div className="price">{price}</div>:null}</div>{badge?<div className="badge">HEUTE NEU</div>:null}</div></article>;
}

export default async function RadarPage() {
  const jar = await cookies();
  const expected = sessionToken();
  const actual = jar.get(COOKIE_NAME)?.value;
  if (!expected || !safeEqual(actual, expected)) redirect('/');

  return <main className="page-shell">
    <div className="toolbar"><form action="/api/logout" method="post"><button className="logout">Abmelden</button></form></div>
    <div className="canvas-wrap"><ScaleCanvas><div className="canvas">
      <header className="header"><div className="brand"><div className="logo"><i></i><b></b></div><div><div className="kicker">DAILY INTELLIGENCE</div><div className="title">PLAYSTATION RADAR</div></div></div><div className="date"><strong>{radar.date}</strong><span>DEUTSCHLAND · DAILY EDITION</span></div></header>
      <div className="newbar"><div className="tag">HEUTE NEU</div><div className="headline">{radar.newHeadline}</div><div className="count">{radar.newCount}</div></div>
      <section className="content"><section className="left"><Card eyebrow="LEAD RELEASE" title={radar.leadTitle} text={radar.leadMeta} price={radar.leadPrice} lead badge/><div className="secondary"><Card eyebrow="RELEASE" title={radar.secondary1Title} text={radar.secondary1Meta} price={radar.secondary1Price}/><Card eyebrow="RELEASE" title={radar.secondary2Title} text={radar.secondary2Meta} price={radar.secondary2Price}/></div></section><aside className="right"><Card eyebrow="PS PLUS" title={radar.psplusTitle} text={radar.psplusText} prominent/><Card eyebrow="STORE DEALS" title={radar.storeTitle} text={radar.storeText}/><Card eyebrow="RELEASES" title={radar.releasesTitle} text={radar.releasesText}/><Card eyebrow="VERLÄSST BALD" title={radar.leavingTitle} text={radar.leavingText} prominent/></aside></section>
      <div className="bottom"><div className="strip"><strong>EA PLAY / UBISOFT+</strong><span>{radar.benefitsText}</span></div><div className="strip radarcheck"><strong>RADAR CHECK</strong><span>{radar.radarCheck}</span></div></div>
    </div></ScaleCanvas></div>
  </main>;
}
