'use client';
import { useMemo, useState } from 'react';
import DetailTile from '../radar/DetailTile';

const SERVICES = {
  'xbox-game-pass:console': 'Game Pass · Konsole',
  'xbox-game-pass:ultimate': 'Game Pass · Ultimate',
  'ea-play:ea-play': 'EA Play',
  'ubisoft-plus:ubisoft-plus': 'Ubisoft+',
};
const TABS = [
  { id: 'deals', label: 'Angebote', view: 'deals' },
  { id: 'xbox-game-pass:console', label: 'Game Pass · Konsole', view: 'gamepass-console' },
  { id: 'xbox-game-pass:ultimate', label: 'Game Pass · Ultimate', view: 'gamepass-ultimate' },
  { id: 'ea-play:ea-play', label: 'EA Play', view: 'ea-play' },
  { id: 'ubisoft-plus:ubisoft-plus', label: 'Ubisoft+', view: 'ubisoft-plus' },
];
const PAGE_SIZE = 48;

function euro(minor) {
  if (!Number.isInteger(minor)) return null;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(minor / 100);
}
function discount(game) {
  if (!Number.isInteger(game.priceMinor) || !Number.isInteger(game.regularPriceMinor) || game.regularPriceMinor <= 0) return null;
  return Math.round((1 - game.priceMinor / game.regularPriceMinor) * 100);
}
function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null
    : new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function GameTile({ game }) {
  const cut = discount(game);
  const price = euro(game.priceMinor);
  const regular = euro(game.regularPriceMinor);
  const detail = {
    kind: 'catalog-game', kicker: 'XBOX', title: game.title,
    image: game.cover || null, gallery: game.cover ? [game.cover] : [],
    summary: 'Eintrag aus dem offiziellen Xbox-Katalog für Deutschland. Verfügbarkeit, Preis und Abo-Berechtigung im Microsoft Store prüfen.',
    rows: [
      { label: 'Preis', value: price },
      { label: 'Regulär', value: cut ? regular : null },
      { label: 'Rabatt', value: cut ? `−${cut} %` : null },
      { label: 'Abo', value: game.services.map((id) => SERVICES[id] || id).join(' · ') || null },
      { label: 'Plattform', value: game.targets.includes('xbox-series') ? 'Xbox Series X|S' : game.targets.join(' · ') },
      { label: 'Store-ID', value: game.id },
    ].filter((row) => row.value != null && row.value !== ''),
    links: [{ label: 'Microsoft Store', url: game.storeUrl }],
  };
  return <DetailTile detail={detail} className="catalog-tile">
    <article className="catalog-card">
      <div className="catalog-art">
        {game.cover ? <img src={game.cover} alt="" loading="lazy" decoding="async" />
          : <span className="catalog-no-art">XB<br /><small>Kein Bild erfasst</small></span>}
      </div>
      <div className="catalog-card-copy">
        <h3>{game.title}</h3>
        {price ? <p>{cut ? <><s>{regular}</s> {price} · −{cut} %</> : price}</p> : null}
        {game.services.length ? <span className="catalog-trial">{game.services.map((id) => SERVICES[id] || id).join(' · ')}</span> : null}
        <span className="catalog-card-more">Details ansehen ↗</span>
      </div>
    </article>
  </DetailTile>;
}

export default function XboxClient({ snapshot }) {
  const [tab, setTab] = useState('deals');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const active = TABS.find((item) => item.id === tab) || TABS[0];
  const coverage = snapshot.coverage.views?.[active.view] || null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de');
    return snapshot.games
      .filter((game) => (tab === 'deals' ? discount(game) !== null : game.services.includes(tab)))
      .filter((game) => !needle || game.title.toLocaleLowerCase('de').includes(needle))
      .sort((a, b) => (tab === 'deals' ? (discount(b) || 0) - (discount(a) || 0) : 0) || a.title.localeCompare(b.title, 'de'));
  }, [snapshot.games, tab, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const select = (value) => { setTab(value); setPage(1); };

  return <div className="catalog-app">
    <header className="catalog-header">
      <nav className="catalog-back">
        <a href="/radar">PlayStation</a>
        <a href="/xbox" aria-current="page" className="is-active">Xbox</a>
        <a href="/preise">Preisradar</a>
      </nav>
      <div className="catalog-heading">
        <div>
          <span className="catalog-eyebrow">XBOX-RADAR · DEUTSCHLAND · BETA</span>
          <h1>Xbox Angebote &amp; Abos</h1>
          <p>Erfasst aus dem offiziellen Xbox-Katalog für Xbox Series X|S. Diese Ansicht ist neu und ausdrücklich als Beta gekennzeichnet: sie erzeugt keine eigene Tagesausgabe und ersetzt keine Prüfung im Microsoft Store.</p>
        </div>
        <div className="catalog-count"><strong>{snapshot.games.length.toLocaleString('de-DE')}</strong><span>erfasste Einträge</span></div>
      </div>
    </header>

    <nav className="catalog-tabs" aria-label="Xbox-Bereiche">
      {TABS.map((item) => <button key={item.id} type="button" className={tab === item.id ? 'active' : ''}
        aria-current={tab === item.id ? 'page' : undefined} onClick={() => select(item.id)}>{item.label}</button>)}
    </nav>

    <section className="catalog-status" aria-live="polite">
      <div>
        <strong>{active.label}</strong>
        <span>{coverage ? `${coverage.count} erfasste Einträge${coverage.complete ? ' · Quelle vollständig geprüft' : ` · Quelle nennt ${coverage.expected ?? '?'}, erfasst wurden ${coverage.observed}`}` : 'Keine Erfassung für diesen Bereich'}</span>
      </div>
      <span className="catalog-date">Quellenstand {dateLabel(snapshot.checkedAt) || '—'}</span>
    </section>

    {coverage && !coverage.complete ? <div className="catalog-warning" role="status">
      Für diesen Bereich nennt die Quelle {coverage.expected ?? '—'} Einträge, geliefert wurden {coverage.observed}. Die Abdeckung ist damit nicht vollständig bestätigt. Es werden keine Einträge ergänzt oder geschätzt. <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Offiziellen Katalog prüfen ↗</a>
    </div> : null}

    {tab === 'deals'
      ? <p className="catalog-note">Preise und Rabatte sind Beobachtungen aus dem offiziellen Katalog zum genannten Quellenstand, keine Zusicherung. Maßgeblich ist der Microsoft Store.</p>
      : <p className="catalog-note">Abo-Zugehörigkeit gilt für die angezeigte Plattform und das genannte Abo. Eine Aufnahme in ein Abo ist kein Besitz und kann enden. Game Pass für PC und Cloud werden hier nicht als Konsolenzugang ausgewiesen.</p>}

    <div className="catalog-filter-head">
      <label className="catalog-search"><span className="sr-only">Spiele suchen</span>
        <input type="search" placeholder="Spiel suchen …" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label>
    </div>

    <div className="catalog-results-head">
      <strong>{filtered.length.toLocaleString('de-DE')} {filtered.length === 1 ? 'Eintrag' : 'Einträge'}</strong>
      <span>{filtered.length ? `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)}` : 'Keine Treffer'}</span>
    </div>

    {visible.length
      ? <div className="catalog-grid">{visible.map((game) => <GameTile key={game.key} game={game} />)}</div>
      : <div className="catalog-empty"><h2>Keine passenden Einträge</h2><p>Für diesen Bereich wurde nichts erfasst. Es werden keine Spiele erfunden oder aus anderen Abos ergänzt.</p>
        <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Offiziellen Xbox-Katalog öffnen ↗</a></div>}

    {pages > 1 ? <nav className="catalog-pagination" aria-label="Ergebnisseiten">
      <button disabled={current <= 1} onClick={() => setPage((value) => value - 1)}>← Zurück</button>
      <span>Seite {current} von {pages}</span>
      <button disabled={current >= pages} onClick={() => setPage((value) => value + 1)}>Weiter →</button>
    </nav> : null}

    <footer className="catalog-footer">
      Private Übersicht · Beta · Keine Kauf- oder Abo-Funktion · Verfügbarkeit, Preis und Berechtigung im Microsoft Store prüfen.
      <br />Quelle: <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">{snapshot.sourceUrl}</a>, Ziel Xbox Series X|S.
    </footer>
  </div>;
}
