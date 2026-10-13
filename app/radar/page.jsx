import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import radar from '../../data/radar.json';
import sources from '../../data/sources.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import DetailTile from './DetailTile';
import catalog from '../../data/ps-plus-catalog.json';
import gameSources from '../../data/game-sources.json';
import { safePlusCover } from '../../lib/radar-media.mjs';
import { currentEssential } from '../../lib/ps-plus-current.mjs';

export const dynamic = 'force-dynamic';

/* RADAR_RESOLVED_SOURCES_V2 */

function daysUntil(iso) {
  if (!iso) return null;
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
  return diff === 0 ? 'HEUTE ERSCHIENEN' : diff < 0 ? `AB ${date.slice(0, 5)}.` : diff === 1 ? 'SEIT GESTERN' : `SEIT ${date.slice(0, 5)}.`;
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

function euroNumber(value) {
  if (!value) return null;
  const normalized = String(value)
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatEuro(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function discountNumber(value) {
  const parsed = Number(String(value || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dealStats(deal) {
  const current = euroNumber(deal.price);
  const old = euroNumber(deal.oldPrice);
  let discount = discountNumber(deal.discount);
  if (!discount && current !== null && old) discount = Math.round((1 - current / old) * 100);
  const saving = current !== null && old !== null && old > current ? old - current : null;
  const remaining = daysUntil(radar.storeEnd);
  const expiry = remaining === null ? 'AKTUELL' : remaining === 0 ? 'ENDET HEUTE' : remaining === 1 ? 'NOCH 1 TAG' : `NOCH ${remaining} TAGE`;
  const strength = discount >= 70 ? 'MEGA-DEAL' : discount >= 50 ? 'STARK' : discount >= 30 ? 'GUT' : 'DEAL';
  const strengthClass = discount >= 70 ? 'is-mega' : discount >= 50 ? 'is-strong' : '';
  return { current, old, discount, saving, remaining, expiry, strength, strengthClass };
}

function shortPsPlus(value) {
  if (!value) return null;
  if (/extra/i.test(value)) return 'PS PLUS EXTRA';
  if (/premium/i.test(value)) return 'PS PLUS PREMIUM';
  return 'IN PS PLUS';
}

function catalogKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/standard\s*edition$/i, '')
    .replace(/[^a-z0-9]+/g, '');
}

function catalogMembership(title) {
  const needle = catalogKey(title);
  if (!needle) return null;
  const game = (catalog.games || []).find((item) => catalogKey(item.title) === needle);
  if (!game) return null;
  const labels = (game.services || []).map((service) => ({
    essential: 'PS Plus Essential',
    extra: 'PS Plus Extra',
    premium: 'PS Plus Premium · Klassiker',
    ubisoft: 'Ubisoft+ Classics',
  }[service] || service)).filter(Boolean);
  return labels.length ? { game, label: labels.join(' · ') } : null;
}

function issueDateParts() {
  const [day, month, year] = String(radar.date || '').split('.').map(Number);
  return { day, month, year };
}

function releaseTiming(date) {
  const [day, month] = String(date || '').split('.').filter(Boolean).map(Number);
  const issue = issueDateParts();
  if (!day || !month || !issue.day || !issue.month || !issue.year) {
    return { days: null, label: 'DEMNÄCHST', fullDate: date || '' };
  }

  let year = issue.year;
  if (month < issue.month - 6) year += 1;
  const target = Date.UTC(year, month - 1, day);
  const current = Date.UTC(issue.year, issue.month - 1, issue.day);
  const days = Math.round((target - current) / 86400000);
  const fullDate = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;

  if (days === 0) return { days, label: 'HEUTE', fullDate };
  if (days === 1) return { days, label: 'MORGEN', fullDate };
  if (days > 1) return { days, label: `IN ${days} TAGEN`, fullDate };
  return { days, label: 'ERSCHIENEN', fullDate };
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

function gameMedia(title, fallbackImage = null) {
  const info = gameInfo(title);
  const gallery = [fallbackImage, ...(info.gallery || [])].filter(Boolean);
  const unique = [...new Set(gallery)].slice(0, 8);
  return {
    image: fallbackImage || unique[0] || null,
    gallery: unique,
  };
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
    ...gameMedia(title, image),
    summary: info.description || text,
    rows: richRows(title, [
      { label: 'Status', value: ageLabel(date) },
      { label: 'Datum', value: date },
      { label: 'Preis', value: price },
      { label: 'Ausgabe', value: radar.edition },
    ]),
    links: gameLinks(title, [
      { label: 'Radar-Quelle', url: alertUrl(title) || radar.resolvedSources?.monthlyReleases || sources.monthlyReleases },
    ]),
  };
}

function psPlusDetail(game, essential) {
  const info = { ...(gameSources[game.title] || {}), ...gameInfo(game.title) };
  const cover = safePlusCover(game, radar, catalog, gameSources[game.title] || {});
  return {
    kicker: 'PLAYSTATION PLUS',
    kind: 'game',
    title: game.title,
    image: cover,
    gallery: cover ? [cover] : [],
    summary: info.description || 'Eintrag aus der verifizierten PlayStation-Plus-Quelle. Beanspruchungszeitraum bitte separat prüfen.',
    rows: richRows(game.title, [
      { label: 'Paket', value: essential.label },
      { label: 'Status', value: essential.title },
      { label: 'Zeitraum / Quellenstand', value: essential.text },
    ]),
    links: gameLinks(game.title, [
      { label: 'Offizielle PS-Plus-Quelle', url: essential.sourceUrl },
      { label: 'PlayStation Store', url: game.storeUrl },
    ]),
  };
}

function dealDetail(deal) {
  const info = gameInfo(deal.title);
  const membership = catalogMembership(deal.title);
  const stats = dealStats(deal);
  const source = radar.resolvedSources?.storeDeals?.[deal.title] || (sources.storeDeals || []).find((item) => item.title === deal.title)?.url;
  return {
    kicker: stats.strength,
    title: deal.title,
    ...gameMedia(deal.title, deal.image),
    summary: info.description || radar.storeText,
    rows: richRows(deal.title, [
      { label: 'Plattform', value: deal.platform },
      { label: 'Aktuell', value: deal.price },
      { label: 'Vorher', value: deal.oldPrice },
      { label: 'Rabatt', value: deal.discount },
      { label: 'Ersparnis', value: formatEuro(stats.saving) },
      { label: 'Deal-Stärke', value: stats.strength },
      { label: 'Restzeit', value: stats.expiry },
      { label: 'Ende', value: displayEndFull(radar.storeEnd) },
      { label: 'Abo-Zugang', value: membership?.label || info.psPlusStatus || null },
      { label: 'Kauf nötig?', value: membership ? 'Nein, solange der passende Abo-Zugang aktiv ist' : null },
    ]),
    bullets: membership ? ['Der angezeigte Storepreis ist der Kaufpreis. Der Titel ist zugleich im erfassten Abo-Katalog enthalten; bei passender Mitgliedschaft ist kein Kauf nötig.'] : [],
    links: gameLinks(deal.title, [
      ...(membership ? [{ label: 'Im PS+-Katalog öffnen', url: '/ps-plus' }] : []),
      ...(source ? [{ label: 'Store-Angebot', url: source }] : []),
    ]),
  };
}

function releaseDetail(item) {
  const info = gameInfo(item.title);
  const timing = releaseTiming(item.date);
  return {
    kicker: 'PS5-RELEASE',
    title: item.title,
    ...gameMedia(item.title),
    summary: info.description || 'Kommender PS5-Release aus dem aktuellen Monats-Radar.',
    rows: richRows(item.title, [
      { label: 'Release', value: timing.fullDate },
      { label: 'Countdown', value: timing.label },
    ]),
    links: gameLinks(item.title, [
      { label: 'Monatsübersicht', url: radar.resolvedSources?.monthlyReleases || sources.monthlyReleases },
    ]),
  };
}

function eaDetail() {
  const title = 'EA SPORTS FC 27';
  const info = gameInfo(title);
  return {
    kicker: 'EA PLAY',
    title: 'EA Play auf PlayStation',
    ...gameMedia(title),
    summary: radar.benefitsText || info.description,
    rows: richRows(title, [
      { label: 'Aktuelles Highlight', value: radar.eaTitle },
      { label: 'Spielebibliothek', value: 'The Play List' },
      { label: 'Mitgliederrabatt', value: (radar.eaItems || []).find((item) => /10\s*%/.test(item)) || '10 % auf digitale EA-Käufe' },
      { label: 'Mitgliederboni', value: (radar.eaItems || []).find((item) => /belohn|boni/i.test(item)) || 'Monatliche Mitgliederbelohnungen' },
    ]),
    bullets: [
      ...(radar.eaItems || []),
      'EA Play umfasst neben zeitlich begrenzten Trials auch eine wechselnde Bibliothek vollständiger Spiele.',
    ],
    links: gameLinks(title, [
      { label: 'EA Play auf PlayStation', url: radar.resolvedSources?.eaPlay || sources.eaPlay },
    ]),
  };
}

function quickDetail(item, essential) {
  if (item === essential.title) {
    const titles = essential.games.map((game) => game.title);
    return {
      kicker: 'PS PLUS',
      title: item,
      summary: essential.text,
      rows: [
        { label: 'Paket', value: essential.label },
        { label: 'Spiele', value: titles.length ? String(titles.length) : null },
        ...titles.map((title, index) => ({ label: `Titel ${index + 1}`, value: title })),
      ].filter((row) => row.value != null && row.value !== ''),
      links: [
        { label: 'Offizielle PS-Plus-Quelle', url: essential.sourceUrl },
      ],
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

function PlusCover({ game, essential }) {
  const cover = safePlusCover(game, radar, catalog, gameSources[game.title] || {});
  return (
    <DetailTile detail={psPlusDetail(game, essential)}>
      <article className="plus-cover">
        <div className={`plus-cover-art ${cover ? "" : "is-missing"}`} style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>{!cover ? <span>Cover nicht verifiziert</span> : null}</div>
        <div className="plus-cover-copy"><strong>{game.title}</strong><small>PS PLUS · {essential.label || 'AKTUELL'}</small></div>
      </article>
    </DetailTile>
  );
}

function DealCard({ deal }) {
  const info = gameInfo(deal.title);
  const media = gameMedia(deal.title, deal.image);
  const stats = dealStats(deal);
  const membership = catalogMembership(deal.title);
  const plus = membership?.label ? shortPsPlus(membership.label) : shortPsPlus(info.psPlusStatus);
  const meta = [deal.platform || info.platform, info.genre].filter(Boolean).slice(0, 2);
  const facts = [info.publisher, info.release ? `Release ${info.release}` : null].filter(Boolean).slice(0, 2);
  const endingClass = stats.remaining !== null && stats.remaining <= 1 ? 'is-ending' : '';
  return (
    <DetailTile detail={dealDetail(deal)} className="deal-showcase-wrap">
      <article className="deal-showcase-card">
        <div className="deal-showcase-art" style={media.image ? { backgroundImage: `url("${media.image}")` } : undefined}>
          <div className="deal-showcase-top">
            <span className={`deal-strength ${stats.strengthClass}`.trim()}>{stats.strength} · -{stats.discount}%</span>
            <span className={`deal-expiry ${endingClass}`.trim()}>{stats.expiry}</span>
          </div>
        </div>
        <div className="deal-showcase-copy">
          {plus ? <span className="deal-plus-badge">{plus}</span> : null}
          <h4>{deal.title}</h4>
          {meta.length ? <div className="deal-showcase-meta">{meta.map(value => <span key={value}>{value}</span>)}</div> : null}
          {facts.length ? <div className="deal-showcase-facts">{facts.join(' · ')}</div> : null}
          <div className="deal-showcase-price">
            <div className="deal-price-values"><del>{deal.oldPrice}</del><strong>{deal.price}</strong></div>
            {stats.saving !== null ? <span className="deal-showcase-saving">Du sparst<br />{formatEuro(stats.saving)}</span> : null}
          </div>
          {membership ? <div className="deal-showcase-psplus-note">Im Abo-Katalog: {membership.label} · Kaufpreis nur relevant ohne passenden Abo-Zugang</div> : info.psPlusStatus ? <div className="deal-showcase-psplus-note">{info.psPlusStatus}</div> : null}
        </div>
      </article>
    </DetailTile>
  );
}

function ReleaseCard({ item }) {
  const info = gameInfo(item.title);
  const media = gameMedia(item.title);
  const timing = releaseTiming(item.date);
  const meta = [info.genre, info.platform].filter(Boolean).slice(0, 2);
  const timingClass = timing.days === 0 ? 'is-today' : timing.days !== null && timing.days <= 3 ? 'is-soon' : '';

  return (
    <DetailTile detail={releaseDetail(item)} className="release-card-wrap">
      <article
        className={`release-card ${media.image ? 'has-art' : 'no-art'}`}
        style={media.image ? { backgroundImage: `url("${media.image}")` } : undefined}
      >
        <div className="release-card-top">
          <span className={`release-countdown ${timingClass}`.trim()}>{timing.label}</span>
        </div>
        {!media.image ? <div className="release-art-placeholder" aria-hidden="true"><span>PS5</span><small>Cover noch nicht verifiziert</small></div> : null}
        <div className="release-card-copy">
          <span className="release-date">{timing.fullDate}</span>
          <h4>{item.title}</h4>
          {meta.length ? (
            <div className="release-card-meta">
              {meta.map((value) => <span key={value}>{value}</span>)}
            </div>
          ) : null}
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

  const essential = currentEssential(radar, catalog);
  const quickItems = (radar.quickItems || []).map(item => item === radar.psplusTitle ? essential.title : item);
  const remaining = daysUntil(radar.storeEnd);
  const storeEnd = displayEnd(radar.storeEnd);
  const nextRelease = radar.releases?.[0] || null;
  const nextTiming = nextRelease ? releaseTiming(nextRelease.date) : null;
  const dealMetrics = (radar.deals || []).map((deal) => ({ deal, ...dealStats(deal) }));
  const bestDeal = [...dealMetrics].sort((a, b) => b.discount - a.discount)[0] || null;
  const averageDiscount = dealMetrics.length
    ? Math.round(dealMetrics.reduce((sum, item) => sum + item.discount, 0) / dealMetrics.length)
    : 0;

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
<a className="logout platform-switch is-active" href="/radar" aria-current="page">PlayStation</a>
        <a className="logout platform-switch" href="/xbox">Xbox <b>BETA</b></a>
        <a className="logout" href="/ps-plus">PS+-Katalog</a>
        <a className="logout" href="/preise">Preisradar</a>
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

        <div className="mag-ticker"><strong>{(radar.dailyChanges || []).some(item => item.verified === true && item.date === radar.date) ? "HEUTE NEU" : "AKTUELL"}</strong><span>{radar.newHeadline}</span><b>{radar.newCount}</b></div>

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

        <Panel tone="plus" icon="＋" title={`PLAYSTATION PLUS · ${essential.label}`} className="mag-plus">
          <DetailTile detail={{
            kicker: 'PLAYSTATION PLUS',
            kind: 'summary',
            title: essential.title,
            summary: essential.text,
            rows: [{ label: 'Quelle', value: essential.label }],
            links: [{ label: 'Offizieller PS-Plus-Katalog', url: essential.sourceUrl }],
          }}>
            <div className="plus-summary compact-summary">
              <div><span>ESSENTIAL</span><h4>{essential.title}</h4></div><p>{essential.text}</p>
            </div>
          </DetailTile>
          <div className="plus-catalog-nav"><a href="/ps-plus">Alle PS+-Spiele anzeigen <span aria-hidden="true">↗</span></a><small>Essential · Extra · Premium · Ubisoft+ Classics</small></div>
          {essential.games.length ? <div className="plus-covers">
            {essential.games.map((game) => <PlusCover key={game.title} game={game} essential={essential} />)}
          </div> : null}
        </Panel>

        <section className="mag-focusgrid">
          {remaining === null ? (
            <Panel tone="store" icon="✓" title="STORE-CHECK" className="compact-panel">
              <div className="deadline-row">
                <div><h4>Keine aktive verifizierte Store-Aktion</h4><p>Der Radar veröffentlicht keine abgelaufenen Angebotsdaten.</p>
                  <details className="radar-help">
                    <summary>Was heißt das?</summary>
                    <p>Gemeint ist eine <b>zeitlich begrenzte Aktion des PlayStation Store</b> – etwa ein Sale mit eigener Kategorieseite. Eine solche läuft gerade nicht, deshalb steht hier kein Countdown. Das heißt <b>nicht</b>, dass es keine reduzierten Spiele gibt: Einzelangebote und ihr Verlauf stehen im <a href="/preise">Preisradar</a>. Dort gezeigte Preise sind eigene Messwerte – ein Titel ohne aktuelles Angebot wird als „zuletzt gemessen“ ausgewiesen, nicht als laufender Deal.</p>
                  </details>
                </div>
                <div className="mag-deadline">—</div>
              </div>
            </Panel>
          ) : (
            <DetailTile detail={{
              kicker: 'ENDET BALD',
              title: radar.leavingTitle,
              summary: radar.leavingText,
              rows: compactRows([
                { label: 'Verbleibend', value: `${remaining} ${remaining === 1 ? 'Tag' : 'Tage'}` },
                { label: 'Ende', value: displayEndFull(radar.storeEnd) },
                { label: 'Im Radar verifiziert', value: radar.deals?.length ? `${radar.deals.length} Produkte` : null },
                ...(radar.deals || []).map((deal, index) => ({ label: `Produkt ${index + 1}`, value: deal.title })),
              ]),
              bullets: ['Die Liste nennt die vom Radar einzeln verifizierten Produkte der aktiven Store-Aktion. Sie ist keine Behauptung, dass damit sämtliche Aktionsspiele erfasst sind.'],
              links: [{ label: 'Verifizierte Store-Deals', url: '/preise' }],
            }} className="radar-panel-clickable">
              <Panel tone="danger" icon="⌛" title="ENDET BALD" className="compact-panel">
                <div className="deadline-row">
                  <div><h4>{radar.leavingTitle}</h4><p>{radar.leavingText}</p></div>
                  <div className="mag-deadline">{remaining} {remaining === 1 ? 'TAG' : 'TAGE'}</div>
                </div>
              </Panel>
            </DetailTile>
          )}

          <Panel tone="store" icon="◆" title={`STORE-DEALS · ${radar.deals.length}`} className="store-showcase">
            <div className="store-showcase-intro">
              <div>
                <h4>{radar.storeTitle}</h4>
                <p>{radar.storeText}</p>
              </div>
              <div className="store-showcase-stats">
                <div className="store-stat"><small>BESTER DEAL</small><b>{bestDeal ? `-${bestDeal.discount}%` : '—'}</b></div>
                <div className="store-stat"><small>Ø RABATT</small><b>{averageDiscount ? `-${averageDiscount}%` : '—'}</b></div>
                <div className="store-stat"><small>ENDET</small><b>{remaining === null ? '—' : remaining === 0 ? 'HEUTE' : remaining === 1 ? '1 TAG' : `${remaining} TAGE`}</b></div>
              </div>
            </div>
            <div className={`deal-showcase-grid deal-count-${Math.min(radar.deals.length, 3)}`}>
              {radar.deals.map((deal) => <DealCard key={deal.title} deal={deal} />)}
            </div>
            <div className="store-intro" style={{ marginTop: 9, marginBottom: 0 }}>
              <div><p>Preise und Rabatte aus dem deutschen PlayStation Store.</p></div>
              <span>{storeEnd ? `bis ${storeEnd}` : 'aktuell'}</span>
            </div>
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
            rows: compactRows([
              { label: 'Erfasste Spiele', value: catalog.sections?.ubisoft?.count != null ? String(catalog.sections.ubisoft.count) : null },
              { label: 'Katalogstatus', value: catalog.sections?.ubisoft?.complete ? 'Quelle vollständig geprüft' : 'Abdeckung nicht vollständig bestätigt' },
              { label: 'Direktabo', value: '7,99 €/Monat' },
              { label: 'Enthalten über', value: 'PS Plus Extra / Premium' },
            ]),
            bullets: [
              ...(radar.ubisoftItems || []),
              'Der vollständige erfasste Ubisoft+ Classics-Katalog ist im PS+-Katalog durchsuchbar.',
            ],
            links: [
              { label: 'Ubisoft+ Classics-Katalog', url: '/ps-plus?tab=ubisoft' },
              { label: 'Ubisoft+ auf PlayStation', url: radar.resolvedSources?.ubisoftPlus || sources.ubisoftPlus },
            ],
          }} className="radar-panel-clickable">
            <Panel tone="ubi" icon="◎" title="UBISOFT+">
              <p>{radar.ubisoftText}</p>
              <div className="ubi-list">{(radar.ubisoftItems || []).map((item) => <span key={item}>{item}</span>)}</div>
            </Panel>
          </DetailTile>
        </section>

        <section className="mag-bottomgrid">
          <Panel tone="releases" icon="▦" title={`KOMMENDE PS5-RELEASES · ${radar.releases.length}`} className="release-showcase">
            {nextRelease && nextTiming ? (
              <div className="release-intro">
                <div className="release-intro-copy">
                  <strong>{radar.releases.length} Releases im Blick</strong>
                  <span>Nächster Termin: {nextRelease.title} · {nextTiming.fullDate}</span>
                </div>
                <b className="release-intro-badge">{nextTiming.label}</b>
              </div>
            ) : null}
            <div className="release-grid">
              {radar.releases.map((item) => <ReleaseCard key={`${item.date}-${item.title}`} item={item} />)}
            </div>
          </Panel>

          <Panel tone="quick" icon="✓" title="KURZ & KOMPAKT" className="quick-showcase">
            <ul className="quick-list">
              {quickItems.map((item) => (
                <li key={item}>
                  <DetailTile detail={quickDetail(item, essential)} className="quick-item-clickable">{item}</DetailTile>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <footer className="mag-footer"><span>PLAY HAS NO LIMITS.</span><small>{String(radar.radarCheck || '').replace(/(\d+\/\d+) Details\b/, '$1 Detailfelder')}</small></footer>
      </div>
    </main>
  );
}
