import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import radar from '../../data/radar.json';
import sources from '../../data/sources.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import DetailTile from './DetailTile';

export const dynamic = 'force-dynamic';

function daysUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function ageLabel(date) {
  if (!date) return 'NEWS';
  const [d, m, y] = date.split('.').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  const today = Date.UTC(get('year'), get('month') - 1, get('day'));
  const diff = Math.round((today - then) / 86400000);
  return diff <= 0 ? 'HEUTE ERSCHIENEN' : diff === 1 ? 'SEIT GESTERN' : `SEIT ${date.slice(0, 5)}.`;
}

function displayEnd(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit'
  }).format(new Date(iso));
}

function displayEndFull(iso) {
  if (!iso) return '';
  return `${new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(iso))} Uhr`;
}

function alertUrl(title) {
  const needle = String(title || '').toLowerCase();
  if (!needle) return null;
  const alerts = radar.sourceAlerts || [];
  const exact = alerts.find((item) => String(item.title || '').toLowerCase() === needle);
  if (exact) return exact.url;
  return alerts.find((item) => {
    const candidate = String(item.title || '').toLowerCase();
    return candidate.includes(needle) || needle.includes(candidate);
  })?.url || null;
}

function compactRows(rows) {
  return rows.filter((row) => row.value !== undefined && row.value !== null && row.value !== '');
}

function gameInfo(title) {
  return radar.gameDetails?.[title] || {};
}

function richRows(title, baseRows = []) {
  const info = gameInfo(title);
  const used = new Set(baseRows.map((row) => row.label));
  const extra = [
    { label: 'Genre', value: info.genre },
    { label: 'Entwickler', value: info.developer },
    { label: 'Publisher', value: info.publisher },
    { label: 'Plattform', value: info.platform },
    { label: 'Release', value: info.release },
    { label: 'PS Plus', value: info.psPlusStatus },
  ].filter((row) => !used.has(row.label));
  return compactRows([...baseRows, ...extra]);
}

function gameLinks(title, fallbackLinks = []) {
  const info = gameInfo(title);
  const links = [
    info.storeUrl ? { label: 'PlayStation Store', url: info.storeUrl } : null,
    info.pageUrl ? { label: 'PlayStation-Seite', url: info.pageUrl } : null,
    info.trailerUrl ? { label: 'Trailer / Video', url: info.trailerUrl } : null,
    ...fallbackLinks,
  ].filter(Boolean);
  const seen = new Set();
  return links.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function storyDetail({ title, date, text, price, image, top = false }) {
  const info = gameInfo(title);
  return {
    kicker: top ? 'TOP-NEWS' : 'NEWS',
    title,
    image,
    summary: info.description || text,
    rows: richRows(title, [
      { label: 'Status', value: ageLabel(date) },
      { label: 'Datum', value: date },
      { label: 'Preis', value: price },
      { label: 'Ausgabe', value: radar.edition },
    ]),
    links: gameLinks(title, [
      { label: 'Radar-Quelle', url: alertUrl(title) || sources.monthlyReleases },
    ]),
  };
}

function psPlusDetail(game) {
  const info = gameInfo(game.title);
  return {
    kicker: 'PLAYSTATION PLUS',
    title: game.title,
    image: game.image,
    summary: info.description || 'Teil der aktuell im Radar geführten monatlichen PlayStation-Plus-Spiele.',
    rows: richRows(game.title, [
      { label: 'Paket', value: radar.psplusLabel },
      { label: 'Status', value: radar.psplusTitle },
      { label: 'Zeitraum', value: radar.psplusText },
    ]),
    links: gameLinks(game.title, [
      { label: 'PS-Plus-Ankündigung', url: sources.psPlusMonthly },
    ]),
  };
}

function dealDetail(deal) {
  const info = gameInfo(deal.title);
  const source = (sources.storeDeals || []).find((item) => item.title === deal.title)?.url;
  return {
    kicker: 'PLAYSTATION STORE',
    title: deal.title,
    image: deal.image,
    summary: info.description || radar.storeText,
    rows: richRows(deal.title, [
      { label: 'Plattform', value: deal.platform },
      { label: 'Aktuell', value: deal.price },
      { label: 'Vorher', value: deal.oldPrice },
      { label: 'Rabatt', value: deal.discount },
      { label: 'Ende', value: displayEndFull(radar.storeEnd) },
    ]),
    links: gameLinks(deal.title, source ? [{ label: 'Store-Angebot', url: source }] : []),
  };
}

function releaseDetail(item) {
  const info = gameInfo(item.title);
  return {
    kicker: 'PS5-RELEASE',
    title: item.title,
    summary: info.description || 'Kommender PS5-Release aus dem aktuellen Monats-Radar.',
    rows: richRows(item.title, [
      { label: 'Release', value: item.date },
    ]),
    links: gameLinks(item.title, [
      { label: 'Monatsübersicht', url: sources.monthlyReleases },
    ]),
  };
}

function eaDetail() {
  const title = 'EA SPORTS FC 27';
  const info = gameInfo(title);
  return {
    kicker: 'EA PLAY',
    title: radar.eaTitle || title,
    summary: info.description || radar.benefitsText,
    rows: richRows(title, [
      { label: 'EA-Play-Vorteil', value: radar.eaTitle },
    ]),
    bullets: radar.eaItems || [],
    links: gameLinks(title, [
      { label: 'EA Play', url: sources.eaPlay },
    ]),
  };
}

function quickDetail(item) {
  if (item === radar.psplusTitle) {
    return {
      kicker: 'PS PLUS',
      title: item,
      summary: radar.psplusText,
      rows: [{ label: 'Paket', value: radar.psplusLabel }],
      links: [{ label: 'PS-Plus-Ankündigung', url: sources.psPlusMonthly }],
    };
  }
  if (item === radar.eaTitle) return eaDetail();
  return {
    kicker: 'KURZMELDUNG',
    title: item,
    summary: 'Kurzmeldung aus der aktuellen PlayStation-Radar-Ausgabe.',
    links: alertUrl(item) ? [{ label: 'Offizielle Quelle', url: alertUrl(item) }] : [],
  };
}

function StoryCard({ image, eyebrow, title, text, price, className = '', detail }) {
  return (
    <DetailTile detail={detail}>
      <article
        className={`mag-story ${className}`}
        style={{ backgroundImage: `linear-gradient(180deg,rgba(3,8,18,.06),rgba(3,8,18,.91)),url("${image}")` }}
      >
        <div className="mag-story-copy">
          <span className="mag-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{text}</p>
          {price ? <strong className="mag-price">{price}</strong> : null}
        </div>
      </article>
    </DetailTile>
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

function PlusCover({ game, label }) {
  return (
    <DetailTile detail={psPlusDetail(game)}>
      <article className="plus-cover">
        <div className="plus-cover-art" style={{ backgroundImage: `url("${game.image}")` }} />
        <div className="plus-cover-copy"><strong>{game.title}</strong><small>PS PLUS · {label || 'AKTUELL'}</small></div>
      </article>
    </DetailTile>
  );
}

function DealCard({ deal }) {
  return (
    <DetailTile detail={dealDetail(deal)}>
      <article className="deal-card">
        <div className="deal-cover-art" style={{ backgroundImage: `url("${deal.image}")` }}>
          <span className="deal-discount">{deal.discount}</span>
        </div>
        <div className="deal-info">
          <strong>{deal.title}</strong><small>{deal.platform}</small>
          <div className="deal-copy"><del>{deal.oldPrice}</del><b>{deal.price}</b></div>
        </div>
      </article>
    </DetailTile>
  );
}

export default async function RadarPage() {
  const jar = await cookies();
  const expected = sessionToken();
  const actual = jar.get(COOKIE_NAME)?.value;
  if (!expected || !safeEqual(actual, expected)) redirect('/');

  const remaining = daysUntil(radar.storeEnd);
  const storeEnd = displayEnd(radar.storeEnd);

  const leadDetail = storyDetail({
    title: radar.leadTitle, date: radar.leadDate, text: radar.leadMeta, price: radar.leadPrice, image: radar.leadImage, top: true,
  });
  const secondary1Detail = storyDetail({
    title: radar.secondary1Title, date: radar.secondary1Date, text: radar.secondary1Meta, price: radar.secondary1Price, image: radar.secondary1Image,
  });
  const secondary2Detail = storyDetail({
    title: radar.secondary2Title, date: radar.secondary2Date, text: radar.secondary2Meta, price: radar.secondary2Price, image: radar.secondary2Image,
  });

  return (
    <main className="mag-shell">
      <div className="mag-toolbar">
        <a className="logout" href="/archive">Archiv</a>
        <a className="logout" href="/daily/latest.png">Bild</a>
        <form action="/api/logout" method="post"><button className="logout">Abmelden</button></form>
      </div>

      <div className="magazine">
        <header className="mag-masthead">
          <div className="mag-psmark">PS</div>
          <div className="mag-brandblock">
            <div className="mag-brand">PLAYSTATION-RADAR</div>
            <div className="mag-subbrand">NEWS MAGAZINE · DEUTSCHLAND</div>
          </div>
          <div className="mag-datebox"><strong>{radar.date}</strong><span>{radar.edition}</span></div>
        </header>

        <div className="mag-ticker"><strong>HEUTE NEU</strong><span>{radar.newHeadline}</span><b>{radar.newCount}</b></div>

        <section className="mag-topgrid">
          <StoryCard
            className="mag-hero"
            image={radar.leadImage}
            eyebrow={`TOP-NEWS · ${ageLabel(radar.leadDate)}`}
            title={radar.leadTitle}
            text={radar.leadMeta}
            price={radar.leadPrice}
            detail={leadDetail}
          />
          <div className="mag-side-stack">
            <StoryCard
              image={radar.secondary1Image}
              eyebrow={ageLabel(radar.secondary1Date)}
              title={radar.secondary1Title}
              text={radar.secondary1Meta}
              price={radar.secondary1Price}
              detail={secondary1Detail}
            />
            <StoryCard
              image={radar.secondary2Image}
              eyebrow={ageLabel(radar.secondary2Date)}
              title={radar.secondary2Title}
              text={radar.secondary2Meta}
              price={radar.secondary2Price}
              detail={secondary2Detail}
            />
          </div>
        </section>

        <Panel tone="plus" icon="＋" title={`PLAYSTATION PLUS · ${radar.psplusLabel || 'AKTUELL'}`} className="mag-plus">
          <DetailTile detail={{
            kicker: 'PLAYSTATION PLUS',
            title: radar.psplusTitle,
            summary: radar.psplusText,
            rows: [{ label: 'Paket', value: radar.psplusLabel }],
            links: [{ label: 'PS-Plus-Ankündigung', url: sources.psPlusMonthly }],
          }}>
            <div className="plus-summary compact-summary">
              <div><span>ESSENTIAL</span><h4>{radar.psplusTitle}</h4></div><p>{radar.psplusText}</p>
            </div>
          </DetailTile>
          <div className="plus-covers">
            {radar.plusGames.map((game) => <PlusCover key={game.title} game={game} label={radar.psplusLabel} />)}
          </div>
        </Panel>

        <section className="mag-focusgrid">
          <DetailTile detail={{
            kicker: 'ENDET BALD',
            title: radar.leavingTitle,
            summary: radar.leavingText,
            rows: compactRows([
              { label: 'Verbleibend', value: `${remaining} ${remaining === 1 ? 'Tag' : 'Tage'}` },
              { label: 'Ende', value: displayEndFull(radar.storeEnd) },
            ]),
          }} className="radar-panel-clickable">
            <Panel tone="danger" icon="⌛" title="ENDET BALD" className="compact-panel">
              <div className="deadline-row">
                <div><h4>{radar.leavingTitle}</h4><p>{radar.leavingText}</p></div>
                <div className="mag-deadline">{remaining} {remaining === 1 ? 'TAG' : 'TAGE'}</div>
              </div>
            </Panel>
          </DetailTile>

          <Panel tone="store" icon="◆" title="STORE-DEALS">
            <div className="store-intro">
              <div><h4>{radar.storeTitle}</h4><p>{radar.storeText}</p></div>
              <span>{storeEnd ? `bis ${storeEnd}` : 'aktuell'}</span>
            </div>
            <div className="deal-grid">{radar.deals.map((deal) => <DealCard key={deal.title} deal={deal} />)}</div>
          </Panel>
        </section>

        <section className="benefit-grid">
          <DetailTile detail={eaDetail()} className="radar-panel-clickable">
            <Panel tone="ea" icon="EA" title="EA PLAY">
              <p>{radar.benefitsText}</p>{radar.eaTitle ? <div className="ea-chip">{radar.eaTitle}</div> : null}
            </Panel>
          </DetailTile>

          <DetailTile detail={{
            kicker: 'UBISOFT+',
            title: radar.ubisoftTitle,
            summary: radar.ubisoftText,
            bullets: radar.ubisoftItems || [],
            links: [{ label: 'Ubisoft+ auf PlayStation', url: sources.ubisoftPlus }],
          }} className="radar-panel-clickable">
            <Panel tone="ubi" icon="◎" title="UBISOFT+">
              <p>{radar.ubisoftText}</p>
              <div className="ubi-list">{(radar.ubisoftItems || []).map((item) => <span key={item}>{item}</span>)}</div>
            </Panel>
          </DetailTile>
        </section>

        <section className="mag-bottomgrid">
          <Panel tone="releases" icon="▦" title="KOMMENDE PS5-RELEASES">
            <div className="release-list">
              {radar.releases.map((item) => (
                <DetailTile key={`${item.date}-${item.title}`} detail={releaseDetail(item)}>
                  <div className="release-row"><b>{item.date}</b><span>{item.title}</span></div>
                </DetailTile>
              ))}
            </div>
          </Panel>

          <Panel tone="quick" icon="✓" title="KURZ & KOMPAKT">
            <ul className="quick-list">
              {(radar.quickItems || []).map((item) => (
                <li key={item}>
                  <DetailTile detail={quickDetail(item)} className="quick-item-clickable">{item}</DetailTile>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <footer className="mag-footer"><span>PLAY HAS NO LIMITS.</span><small>{radar.radarCheck}</small></footer>
      </div>
    </main>
  );
}
