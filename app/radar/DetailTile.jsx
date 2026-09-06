'use client';

import { useRef } from 'react';

export default function DetailTile({ children, detail, className = '' }) {
  const dialogRef = useRef(null);

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

            {detail.sourceUrl ? (
              <a className="radar-sheet-source" href={detail.sourceUrl} target="_blank" rel="noreferrer">
                Offizielle Quelle öffnen ↗
              </a>
            ) : null}
          </div>
        </section>
      </dialog>
    </>
  );
}
