'use client';

import { useRef } from 'react';

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

export default function DetailTile({ children, detail, className = '' }) {
  const dialogRef = useRef(null);
  const links = linkList(detail);
  const badges = badgeList(detail);

  function open() {
    dialogRef.current?.showModal();
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  }

  return (
    <>
      <div
        className={`radar-clickable ${className}`.trim()}
        role="button"
        tabIndex={0}
        aria-label={`Mehr Informationen zu ${detail.title}`}
        onClick={open}
        onKeyDown={onKeyDown}
      >
        {children}
        <span className="radar-more" aria-hidden="true">i</span>
      </div>

      <dialog
        ref={dialogRef}
        className="radar-dialog"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <section className="radar-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="radar-sheet-handle" aria-hidden="true" />
          <button
            type="button"
            className="radar-sheet-close"
            aria-label="Schließen"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>

          {detail.image ? (
            <div
              className="radar-sheet-image"
              style={{ backgroundImage: `url("${detail.image}")` }}
              aria-hidden="true"
            />
          ) : null}

          <div className="radar-sheet-content">
            <div className="radar-sheet-heading">
              {detail.kicker ? <span className="radar-sheet-kicker">{detail.kicker}</span> : null}
              <h2>{detail.title}</h2>
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

            {detail.summary ? <p className="radar-sheet-summary">{detail.summary}</p> : null}

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
                {links.map((item) => (
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
