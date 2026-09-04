import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import radar from '../../data/radar.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';

export const dynamic = 'force-dynamic';

function StoryCard({ image, eyebrow, title, text, price, className = '' }) {
  return (
    <article className={`mag-story ${className}`} style={{ backgroundImage: `linear-gradient(180deg, rgba(3,8,18,.08), rgba(3,8,18,.92)), url("${image}")` }}>
      <div className="mag-story-copy">
        <span className="mag-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{text}</p>
        {price ? <strong className="mag-price">{price}</strong> : null}
      </div>
    </article>
  );
}

function Panel({ tone, icon, title, children, className = '' }) {
  return (
    <section className={`mag-panel tone-${tone} ${className}`}>
      <div className="mag-panel-head"><span className="mag-panel-icon">{icon}</span><h3>{title}</h3></div>
      <div className="mag-panel-body">{children}</div>
    </section>
  );
}

export default async function RadarPage() {
  const jar = await cookies();
  const expected = sessionToken();
  const actual = jar.get(COOKIE_NAME)?.value;
  if (!expected || !safeEqual(actual, expected)) redirect('/');

  return (
    <main className="mag-shell">
      <div className="mag-toolbar"><form action="/api/logout" method="post"><button className="logout">Abmelden</button></form></div>

      <div className="magazine">
        <header className="mag-masthead">
          <div className="mag-psmark">PS</div>
          <div className="mag-brandblock">
            <div className="mag-brand">PLAYSTATION-RADAR</div>
            <div className="mag-subbrand">NEWS MAGAZINE · DEUTSCHLAND</div>
          </div>
          <div className="mag-datebox"><strong>{radar.date}</strong><span>{radar.edition}</span></div>
        </header>

        <div className="mag-ticker">
          <strong>HEUTE NEU</strong><span>{radar.newHeadline}</span><b>{radar.newCount}</b>
        </div>

        <section className="mag-topgrid">
          <StoryCard
            className="mag-hero"
            image={radar.leadImage}
            eyebrow="TOP-NEWS · HEUTE ERSCHIENEN"
            title={radar.leadTitle}
            text={radar.leadMeta}
            price={radar.leadPrice}
          />
          <div className="mag-side-stack">
            <StoryCard image={radar.secondary1Image} eyebrow="RELEASE" title={radar.secondary1Title} text={radar.secondary1Meta} price={radar.secondary1Price} />
            <StoryCard image={radar.secondary2Image} eyebrow="SEIT GESTERN" title={radar.secondary2Title} text={radar.secondary2Meta} price={radar.secondary2Price} />
          </div>
        </section>

        <Panel tone="plus" icon="＋" title="PLAYSTATION PLUS · SEPTEMBER 2026" className="mag-plus">
          <div className="plus-grid">
            <div className="plus-lead"><span>ESSENTIAL</span><h4>{radar.psplusTitle}</h4><p>{radar.psplusText}</p></div>
            <div className="plus-mini"><b>EXTRA</b><span>Katalog-Updates im Radar</span></div>
            <div className="plus-mini"><b>PREMIUM</b><span>Klassiker, Trials & Cloud-Updates</span></div>
          </div>
        </Panel>

        <section className="mag-midgrid">
          <Panel tone="danger" icon="⌛" title="VERLÄSST / ENDET BALD">
            <h4>{radar.leavingTitle}</h4><p>{radar.leavingText}</p><div className="mag-deadline">NOCH 6 TAGE</div>
          </Panel>
          <Panel tone="store" icon="◆" title="AKTUELLE STORE-DEALS">
            <h4>{radar.storeTitle}</h4><p>{radar.storeText}</p><div className="deal-row"><span>STORE</span><b>bis 10.09.</b></div>
          </Panel>
          <Panel tone="ea" icon="EA" title="EA PLAY AUF PLAYSTATION">
            <p>{radar.benefitsText}</p><div className="ea-chip">FC 27 · 10h Trial ab 18.09.</div>
          </Panel>
        </section>

        <section className="mag-bottomgrid">
          <Panel tone="ubi" icon="◎" title="UBISOFT+">
            <p>{radar.ubisoftText}</p><div className="ubi-list"><span>Assassin’s Creed</span><span>Far Cry</span><span>Watch Dogs</span></div>
          </Panel>
          <Panel tone="releases" icon="▦" title="KOMMENDE PS5-RELEASES">
            <div className="release-list">
              <div><b>04.09.</b><span>Onimusha + NBA 2K27</span></div>
              <div><b>08.09.</b><span>Mewgenics</span></div>
              <div><b>15.09.</b><span>Marvel’s Wolverine</span></div>
            </div>
          </Panel>
          <Panel tone="quick" icon="✓" title="KURZ & KOMPAKT">
            <ul className="quick-list">
              <li>Onimusha und NBA 2K27 heute neu</li>
              <li>PS Plus September-Spiele verfügbar</li>
              <li>gamescom-Rabatte bis 10.09.</li>
              <li>FC 27 Trial ab 18.09. über EA Play</li>
            </ul>
          </Panel>
        </section>

        <footer className="mag-footer"><span>PLAY HAS NO LIMITS.</span><small>{radar.radarCheck}</small></footer>
      </div>
    </main>
  );
}
