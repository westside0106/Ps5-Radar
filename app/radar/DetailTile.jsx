'use client';

import { useEffect, useRef, useState } from 'react';
import priceHistory from '../../data/price-history.json';

const WATCHLIST_KEY = 'psradar_watchlist_v1';
const WATCHLIST_EVENT = 'psradar-watchlist';

function linkList(detail) {
  const links = [...(detail.links || [])];
  if (detail.sourceUrl) links.push({ label: 'Offizielle Quelle', url: detail.sourceUrl });
  const seen = new Set();
  return links.filter((item) => {
    if (!item?.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function galleryList(detail) {
  const images = [detail.image, ...(detail.gallery || [])].filter(Boolean);
  return [...new Set(images)].slice(0, 8);
}

function youtubeEmbedUrl(url = '') {
  try {
    const parsed = new URL(url);
    let id = null;
    if (parsed.hostname === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0];
    if (/youtube\.com$/i.test(parsed.hostname) || /\.youtube\.com$/i.test(parsed.hostname)) {
      if (parsed.pathname === '/watch') id = parsed.searchParams.get('v');
      if (parsed.pathname.startsWith('/embed/')) id = parsed.pathname.split('/embed/')[1]?.split('/')[0];
      if (parsed.pathname.startsWith('/shorts/')) id = parsed.pathname.split('/shorts/')[1]?.split('/')[0];
    }
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  } catch {
    return null;
  }
}

function badgeList(detail) {
  const priority = ['Genre', 'Plattform', 'PS Plus', 'Rabatt', 'Status'];
  const rows = detail.rows || [];
  const badges = [];
  for (const label of priority) {
    const row = rows.find((item) => item.label === label);
    if (!row?.value) continue;
    const value = String(row.value);
    if (value.length > 48) continue;
    badges.push({ label, value });
    if (badges.length === 4) break;
  }
  return badges;
}

function rowValue(detail, label) {
  return detail.rows?.find((row) => row.label === label)?.value || null;
}

function claimDate(detail) {
  const source = [rowValue(detail, 'Zeitraum'), rowValue(detail, 'PS Plus'), detail.summary]
    .filter(Boolean)
    .join(' ');
  const match = source.match(/bis\s+(\d{1,2}\.\d{1,2}\.)/i);
  return match?.[1] || null;
}

function servicePrice(detail) {
  const source = [detail.summary, ...(detail.bullets || [])].filter(Boolean).join(' ');
  const match = source.match(/(\d{1,3},\d{2}\s*€)(?:\s*\/\s*Monat|\/Monat)?/i);
  return match?.[1] || null;
}

function trialDate(detail) {
  const source = [detail.title, detail.summary].filter(Boolean).join(' ');
  return source.match(/ab\s+(\d{1,2}\.\d{1,2}\.)/i)?.[1] || null;
}

function actionKind(label = '') {
  if (/trailer|video/i.test(label)) return 'video';
  if (/store/i.test(label)) return 'primary';
  if (/playstation-seite/i.test(label)) return 'playstation';
  return 'secondary';
}

function actionGlyph(label = '') {
  if (/trailer|video/i.test(label)) return '▶';
  if (/store/i.test(label)) return '◆';
  if (/playstation/i.test(label)) return 'PS';
  return '↗';
}

function readWatchlist() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map((item) => typeof item === 'string' ? { title: item } : item).filter((item) => item?.title) : [];
  } catch {
    return [];
  }
}

function historyPoints(title) {
  return priceHistory.games?.[title]?.points || [];
}

function dealSignal(title) {
  return priceHistory.games?.[title]?.signal || null;
}

function formatHistoryPrice(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function shortHistoryDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.` : value;
}

function PriceHistory({ title }) {
  const points = historyPoints(title).slice(-30);
  if (!points.length) return null;

  const values = points.map((point) => point.price).filter(Number.isFinite);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const current = values.at(-1);
  const span = Math.max(0.01, max - min);
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 50 : 4 + (index / (points.length - 1)) * 92;
    const y = 34 - ((point.price - min) / span) * 28;
    return { x, y, ...point };
  });
  const path = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const atLow = Math.abs(current - min) < 0.005;
  const status = points.length === 1
    ? 'STARTWERT'
    : atLow
      ? 'RADAR-TIEF'
      : `${formatHistoryPrice(current - min)} ÜBER RADAR-TIEF`;

  return (
    <div className="radar-price-history">
      <div className="radar-price-history-head">
        <div><small>PREISVERLAUF · {points.length} {points.length === 1 ? 'MESSPUNKT' : 'MESSPUNKTE'}</small><strong>{status}</strong></div>
        <b>{formatHistoryPrice(current)}</b>
      </div>
      <svg viewBox="0 0 100 38" role="img" aria-label={`Preisverlauf für ${title}`}>
        {points.length > 1 ? <path className="radar-price-line" d={path} fill="none" /> : null}
        {coords.map((point) => <circle key={`${point.date}-${point.price}`} cx={point.x} cy={point.y} r="1.8" />)}
      </svg>
      <div className="radar-price-history-foot">
        <span>{shortHistoryDate(points[0].date)} · {formatHistoryPrice(values[0])}</span>
        <span>Tief {formatHistoryPrice(min)}</span>
        <span>{shortHistoryDate(points.at(-1).date)}</span>
      </div>
    </div>
  );
}

function DealSignal({ signal }) {
  if (!signal) return null;
  return (
    <div className={`radar-deal-signal signal-${signal.code}`}>
      <div className="radar-deal-signal-head">
        <div>
          <small>RADAR-SIGNAL</small>
          <strong>{signal.label}</strong>
        </div>
        <span>Sicherheit {signal.confidence}</span>
      </div>
      <p>{signal.reason}</p>
      <div className="radar-deal-signal-meta">
        {Number.isFinite(signal.radarLow) ? <span>Radar-Tief {formatHistoryPrice(signal.radarLow)}</span> : null}
        {Number.isFinite(signal.deltaFromLowPct) ? <span>{signal.deltaFromLowPct === 0 ? 'am Tief' : `${String(signal.deltaFromLowPct).replace('.', ',')} % über Tief`}</span> : null}
        {signal.daysRemaining !== null && signal.daysRemaining !== undefined ? (
          <span>{signal.daysRemaining === 0 ? 'endet heute' : signal.daysRemaining === 1 ? 'noch 1 Tag' : `noch ${signal.daysRemaining} Tage`}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function DetailTile({ children, detail, className = '' }) {
  const dialogRef = useRef(null);
  const links = linkList(detail);
  const badges = badgeList(detail);
  const gallery = galleryList(detail);
  const trailerLink = links.find((item) => /trailer|video/i.test(item.label || ''))?.url || detail.trailerUrl || null;
  const trailerEmbed = youtubeEmbedUrl(trailerLink || '');
  const [activeImage, setActiveImage] = useState(gallery[0] || null);
  const [isOpen, setIsOpen] = useState(false);
  const [isWatched, setIsWatched] = useState(false);

  // 'catalog-game' bewusst NICHT: die Katalogkachel bringt Titel, Plattform und
  // Aktion selbst mit. Das Plus-Overlay legte darueber einen zweiten Titel, ein
  // fest verdrahtetes "PS PLUS ESSENTIAL" und min-height:310px aus
  // plus-showcase-game - daher die Ueberlappungen im Katalograster.
  const isPlusCard = detail.kind === 'game' || (detail.kicker === 'PLAYSTATION PLUS' && Boolean(detail.image) && !['summary','catalog-game'].includes(detail.kind));
  const isPlusSummary = detail.kind === 'summary' || (detail.kicker === 'PLAYSTATION PLUS' && !detail.image && !['game','catalog-game'].includes(detail.kind));
  const isEaBenefit = detail.kicker === 'EA PLAY';
  const isUbiBenefit = detail.kicker === 'UBISOFT+';
  const isDealDetail = Boolean(rowValue(detail, 'Aktuell'));
  // Die Watchlist beobachtet Preise. Eine Kurzmeldung oder Monatsuebersicht hat
  // kein Store-Produkt und gehoert deshalb nicht auf die Merkliste.
  const canWatch = ['game', 'catalog-game', 'price'].includes(detail.kind)
    || (detail.links || []).some((item) => /store\.playstation\.com/.test(item.url || ''));
  const signal = isDealDetail ? dealSignal(detail.title) : null;
  const plusGenre = rowValue(detail, 'Genre');
  const plusPlatform = rowValue(detail, 'Plattform');
  const plusClaimDate = claimDate(detail);
  const eaTrialDate = isEaBenefit ? trialDate(detail) : null;
  const ubiPrice = isUbiBenefit ? servicePrice(detail) : null;
  const benefitItems = (detail.bullets || []).slice(0, 4);
  const semanticClass = isPlusCard
    ? ' plus-showcase-game'
    : isPlusSummary
      ? ' plus-showcase-summary'
      : isEaBenefit
        ? ' benefit-showcase-ea'
        : isUbiBenefit
          ? ' benefit-showcase-ubi'
          : '';

  useEffect(() => {
    const sync = () => setIsWatched(readWatchlist().some((item) => item.title === detail.title));
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(WATCHLIST_EVENT, sync);
    };
  }, [detail.title]);

  function open() {
    setActiveImage(gallery[0] || null);
    setIsOpen(true);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    dialogRef.current?.close();
  }

  function onKeyDown(event) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  }

  function toggleWatchlist() {
    const items = readWatchlist();
    const exists = items.some((item) => item.title === detail.title);
    const next = exists
      ? items.filter((item) => item.title !== detail.title)
      : [...items, {
          title: detail.title,
          kicker: detail.kicker || null,
          image: detail.image || gallery[0] || null,
          platform: rowValue(detail, 'Plattform'),
          price: rowValue(detail, 'Aktuell') || rowValue(detail, 'Preis'),
          discount: rowValue(detail, 'Rabatt'),
          storeUrl: links.find((item) => /store/i.test(item.label || ''))?.url || null,
          savedAt: new Date().toISOString(),
        }];
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
    setIsWatched(!exists);
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
  }

  return (
    <>
      <div
        className={`radar-clickable ${className}${semanticClass}`.trim()}
        role="button"
        tabIndex={0}
        aria-label={`Mehr Informationen zu ${detail.title}`}
        onClick={(event) => { if (!event.target.closest('a,button,input,select,textarea')) open(); }}
        onKeyDown={onKeyDown}
      >
        {children}

        {isPlusCard ? (
          <div className="plus-showcase-overlay" aria-hidden="true">
            <div className="plus-showcase-topline">
              <span>PS PLUS ESSENTIAL</span>
              {plusClaimDate ? <b>BIS {plusClaimDate}</b> : null}
            </div>
            <div className="plus-showcase-copy">
              <h4>{detail.title}</h4>
              <div className="plus-showcase-meta">
                {plusPlatform ? <span>{plusPlatform}</span> : null}
                {plusGenre ? <span>{plusGenre}</span> : null}
              </div>
              {plusClaimDate ? <small>Nur noch bis {plusClaimDate} beanspruchbar</small> : null}
            </div>
          </div>
        ) : null}

        {isPlusSummary && plusClaimDate ? (
          <div className="plus-claim-window" aria-hidden="true">
            <small>CLAIM-FENSTER</small>
            <b>BIS {plusClaimDate} BEANSPRUCHBAR</b>
          </div>
        ) : null}

        {isEaBenefit ? (
          <div
            className="benefit-showcase-overlay is-ea"
            style={detail.image ? { backgroundImage: `url("${detail.image}")` } : undefined}
            aria-hidden="true"
          >
            <div className="benefit-showcase-layer">
              <div className="benefit-topline">
                <span className="benefit-service-badge ea">EA PLAY</span>
                {eaTrialDate ? <span className="benefit-status-badge is-soon">TRIAL AB {eaTrialDate}</span> : null}
              </div>
              <div className="benefit-content">
                <span className="benefit-kicker">AKTUELLER MEMBER-VORTEIL</span>
                <h4>{detail.title}</h4>
                <span className="benefit-subtitle">10-Stunden-Trial · vor Release spielen</span>
                <div className="benefit-perks">
                  {benefitItems.map((item) => <span key={item}>{item}</span>)}
                </div>
                <div className="benefit-highlight">
                  <strong>10 %</strong>
                  <small>Rabatt auf digitale EA-Käufe für Mitglieder</small>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isUbiBenefit ? (
          <div className="benefit-showcase-overlay is-ubi" aria-hidden="true">
            <div className="benefit-ubi-mark">U+</div>
            <div className="benefit-showcase-layer">
              <div className="benefit-topline">
                <span className="benefit-service-badge ubi">UBISOFT+</span>
                <span className="benefit-status-badge">CLASSICS</span>
              </div>
              <div className="benefit-content">
                <span className="benefit-kicker">PLAYSTATION-KATALOG</span>
                <h4>{detail.title}</h4>
                <span className="benefit-subtitle">Ubisoft-Klassiker auf PlayStation</span>
                {ubiPrice ? (
                  <div className="benefit-ubi-price"><strong>{ubiPrice}</strong><span>/ Monat</span></div>
                ) : null}
                <div className="benefit-perks">
                  {benefitItems.map((item) => <span key={item}>{item}</span>)}
                </div>
                {(detail.bullets || []).some((item) => /PS Plus Extra|PS Plus Premium/i.test(item)) ? (
                  <div className="benefit-ubi-plus">AUCH ÜBER PS PLUS EXTRA / PREMIUM</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {signal?.activeDeal ? <div className="radar-signal-footer"><span className={`radar-signal-pill signal-${signal.code}`}>{signal.label}</span><small>Preisradar · Details ansehen ↗</small></div> : null}
        <span className="radar-more" aria-hidden="true">i</span>
      </div>

      <dialog
        ref={dialogRef}
        className="radar-dialog"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <section className="radar-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="radar-sheet-handle" aria-hidden="true" />
          <div className="radar-sheet-topbar"><span>{detail.kicker || 'SPIELDETAILS'}</span><button type="button" className="radar-sheet-close" aria-label="Schließen" onClick={close}>×</button></div>

          {activeImage ? (
            <div
              className="radar-sheet-image"
              style={{ backgroundImage: `url("${activeImage}")` }}
              aria-hidden="true"
            />
          ) : null}

          {gallery.length > 1 ? (
            <div className="radar-sheet-gallery" aria-label="Bildergalerie">
              {gallery.map((image, index) => (
                <button
                  type="button"
                  key={image}
                  className={`radar-gallery-thumb ${activeImage === image ? 'is-active' : ''}`}
                  onClick={() => setActiveImage(image)}
                  aria-label={`Bild ${index + 1} anzeigen`}
                  aria-pressed={activeImage === image}
                >
                  <span style={{ backgroundImage: `url("${image}")` }} />
                </button>
              ))}
            </div>
          ) : null}

          <div className="radar-sheet-content">
            <div className="radar-sheet-heading">
              {detail.kicker ? <span className="radar-sheet-kicker">{detail.kicker}</span> : null}
              <div className="radar-sheet-title-row">
                <h2>{detail.title}</h2>
                {canWatch ? (
                  <button
                    type="button"
                    className={`radar-watch-button ${isWatched ? 'is-active' : ''}`}
                    onClick={toggleWatchlist}
                    aria-pressed={isWatched}
                  >
                    <span aria-hidden="true">{isWatched ? '★' : '☆'}</span>
                    {isWatched ? 'Gemerkt' : 'Watchlist'}
                  </button>
                ) : null}
              </div>
              {badges.length ? (
                <div className="radar-sheet-badges" aria-label="Schnellinfos">
                  {badges.map((badge) => (
                    <span className="radar-sheet-badge" key={`${badge.label}-${badge.value}`}>
                      <small>{badge.label}</small>
                      <b>{badge.value}</b>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {links.some(item => ['primary','playstation'].includes(actionKind(item.label))) ? (
              <div className="radar-sheet-actions radar-sheet-actions--primary">
                {links.filter(item => ['primary','playstation'].includes(actionKind(item.label))).map(item => <a key={item.url} className={`radar-sheet-action action-${actionKind(item.label)}`} href={item.url} target="_blank" rel="noreferrer"><span className="radar-action-icon" aria-hidden="true">{actionGlyph(item.label)}</span><span>{item.label}</span><b aria-hidden="true">↗</b></a>)}
              </div>
            ) : null}
            {detail.summary ? <p className="radar-sheet-summary">{detail.summary}</p> : null}

            {isDealDetail ? <DealSignal signal={signal} /> : null}
            <PriceHistory title={detail.title} />

            {trailerEmbed && isOpen ? (
              <>
                <div className="radar-sheet-section-title">Trailer</div>
                <div className="radar-sheet-video">
                  <iframe
                    src={trailerEmbed}
                    title={`${detail.title} Trailer`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </>
            ) : null}

            {detail.rows?.length ? (
              <>
                <div className="radar-sheet-section-title">Details</div>
                <dl className="radar-sheet-facts">
                  {detail.rows.map((row) => (
                    <div key={`${row.label}-${row.value}`}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            {detail.bullets?.length ? (
              <>
                <div className="radar-sheet-section-title">Enthalten</div>
                <ul className="radar-sheet-list">
                  {detail.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </>
            ) : null}

            {links.length ? (
              <div className="radar-sheet-actions">
                {links.filter(item => !['primary','playstation'].includes(actionKind(item.label))).map((item) => (
                  <a
                    key={`${item.label}-${item.url}`}
                    className={`radar-sheet-action action-${actionKind(item.label)}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="radar-action-icon" aria-hidden="true">{actionGlyph(item.label)}</span>
                    <span>{item.label || 'Öffnen'}</span>
                    <b aria-hidden="true">↗</b>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </dialog>
    </>
  );
}
