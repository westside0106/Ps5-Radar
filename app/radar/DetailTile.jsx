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

export default function DetailTile({ children, detail, className = '' }) {
  const dialogRef = useRef(null);
  const links = linkList(detail);

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
        <span className="radar-more" aria-hidden="true">＋</span>
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
            {detail.kicker ? <span className="radar-sheet-kicker">{detail.kicker}</span> : null}
            <h2>{detail.title}</h2>
            {detail.summary ? <p className="radar-sheet-summary">{detail.summary}</p> : null}

            {detail.rows?.length ? (
              <dl className="radar-sheet-facts">
                {detail.rows.map((row) => (
                  <div key={`${row.label}-${row.value}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {detail.bullets?.length ? (
              <ul className="radar-sheet-list">
                {detail.bullets.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}

            {links.length ? (
              <div className="radar-sheet-links">
                {links.map((item) => (
                  <a key={`${item.label}-${item.url}`} className="radar-sheet-source" href={item.url} target="_blank" rel="noreferrer">
                    {item.label || 'Öffnen'} ↗
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
