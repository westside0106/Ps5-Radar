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

function enlargedOfficialCover(url) {
  if (!url?.startsWith('https://store-images.s-microsoft.com/image/')) return url || null;
  // The official listing currently supplies mostly 177 × 177 thumbnails.
  // Only adjust existing Microsoft CDN size parameters; never invent artwork.
  return url.replace(/([?&])w=\d+/i, '$1w=640').replace(/([?&])h=\d+/i, '$1h=640');
}

function GameTile({ game }) {
  const [largeFailed, setLargeFailed] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const art = artFailed ? null : largeFailed ? game.cover : enlargedOfficialCover(game.cover);
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
      { label: 'Genre', value: (game.genres || []).join(' · ') || null },
      { label: 'Abo', value: game.services.map((id) => SERVICES[id] || id).join(' · ') || null },
      { label: 'Plattform', value: game.targets.includes('xbox-series') ? 'Xbox Series X|S' : game.targets.join(' · ') },
      { label: 'Store-ID', value: game.id },
    ].filter((row) => row.value != null && row.value !== ''),
    links: [{ label: 'Microsoft Store', url: game.storeUrl }],
  };
  return <DetailTile detail={detail} className="catalog-tile">
    <article className="catalog-card">
      <div className="catalog-art">
        {art ? <img src={art} alt="" loading="lazy" decoding="async"
          onError={() => { if (!largeFailed && art !== game.cover) setLargeFailed(true); else setArtFailed(true); }} />
          : <span className="catalog-no-art">XB<br /><small>Kein Bild erfasst</small></span>}
      </div>
      <div className="catalog-card-copy">
        <h3>{game.title}</h3>
        {price ? <p className={cut ? 'catalog-price-cut' : ''}>{cut ? <><s>{regular}</s>{price}<span className="catalog-price-badge">−{cut} %</span></> : price}</p> : null}
        {game.services.length ? <span className="catalog-trial">{game.services.map((id) => SERVICES[id] || id).join(' · ')}</span> : null}
        <span className="catalog-card-more">Details ansehen ↗</span>
      </div>
    </article>
  </DetailTile>;
}

export default function XboxClient({ snapshot }) {
  const [tab, setTab] = useState('deals');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('relevanz');
  const [genre, setGenre] = useState('all');
  const [onlyWithArt, setOnlyWithArt] = useState(false);
  const [hideFilters, setHideFilters] = useState(false);
  const [page, setPage] = useState(1);
  const active = TABS.find((item) => item.id === tab) || TABS[0];
  const coverage = snapshot.coverage.views?.[active.view] || null;
  const captured = Number(coverage?.count || 0) > 0;
  const captureMissing = !captured && !coverage?.complete;
  const tabGames = useMemo(() => snapshot.games.filter((game) =>
    tab === 'deals' ? discount(game) !== null : game.services.includes(tab)
  ), [snapshot.games, tab]);
  const hasPrices = tabGames.some((game) => Number.isInteger(game.priceMinor));

  // Genres sind nur fuer die Angebotsansicht erfasst. Der Filter erscheint nur,
  // wenn JEDER Eintrag des Bereichs eines hat - sonst wuerde er stillschweigend
  // alles ohne Genre ausblenden. In den Abo-Bereichen tragen nur jene Titel ein
  // Genre, die zugleich im Angebot sind.
  const genres = useMemo(() => {
    const inTab = snapshot.games.filter((game) => (tab === 'deals' ? discount(game) !== null : game.services.includes(tab)));
    if (!inTab.length || inTab.some((game) => !(game.genres || []).length)) return [];
    return [...new Set(inTab.flatMap((game) => game.genres))].sort((a, b) => a.localeCompare(b, 'de'));
  }, [snapshot.games, tab]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de');
    const order = {
      titel: (a, b) => a.title.localeCompare(b.title, 'de'),
      'titel-desc': (a, b) => b.title.localeCompare(a.title, 'de'),
      rabatt: (a, b) => (discount(b) ?? -1) - (discount(a) ?? -1),
      'rabatt-asc': (a, b) => (discount(a) ?? Infinity) - (discount(b) ?? Infinity),
      preis: (a, b) => (a.priceMinor ?? Infinity) - (b.priceMinor ?? Infinity),
      'preis-desc': (a, b) => (b.priceMinor ?? -1) - (a.priceMinor ?? -1),
      'cover-first': (a, b) => Number(Boolean(b.cover)) - Number(Boolean(a.cover)),
      relevanz: (a, b) => (tab === 'deals' ? (discount(b) ?? -1) - (discount(a) ?? -1) : 0),
    }[sort] || (() => 0);
    return snapshot.games
      .filter((game) => (tab === 'deals' ? discount(game) !== null : game.services.includes(tab)))
      .filter((game) => !needle || game.title.toLocaleLowerCase('de').includes(needle))
      .filter((game) => !onlyWithArt || Boolean(game.cover))
      .filter((game) => genre === 'all' || (game.genres || []).includes(genre))
      .sort((a, b) => order(a, b) || a.title.localeCompare(b.title, 'de'));
  }, [snapshot.games, tab, query, sort, onlyWithArt, genre]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const select = (value) => { setTab(value); setGenre('all'); setSort(value === 'deals' ? 'relevanz' : 'titel'); setQuery(''); setOnlyWithArt(false); setPage(1); };
  const update = (setter) => (value) => { setter(value); setPage(1); };

  return <div className="catalog-app is-xbox">
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
        aria-current={tab === item.id ? 'page' : undefined} onClick={() => select(item.id)}>{item.label}{!snapshot.coverage.views?.[item.view]?.count && !snapshot.coverage.views?.[item.view]?.complete ? <small className="xbox-tab-unavailable">ohne Daten</small> : null}</button>)}
    </nav>

    <section className="catalog-status" aria-live="polite">
      <div>
        <strong>{active.label}</strong>
        <span>{captureMissing ? 'Keine belastbare Erfassung verfügbar – nicht mit einem leeren Spielekatalog gleichzusetzen' : coverage ? `${coverage.count} erfasste Einträge${coverage.complete ? ' · Quelle vollständig geprüft' : ' · Quelle noch nicht vollständig bestätigt'}` : 'Keine bestätigten Quelldaten'}</span>
      </div>
      <span className="catalog-date">Quellenstand {dateLabel(snapshot.checkedAt) || '—'}</span>
    </section>

    {captureMissing ? <div className="catalog-warning xbox-coverage-warning" role="status">
      <strong>Dieser Abo-Bereich konnte nicht verlässlich ausgelesen werden.</strong> Das bedeutet nicht, dass dort keine Spiele enthalten sind.
      <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer"> Offiziellen Xbox-Katalog prüfen ↗</a>
    </div> : coverage && !coverage.complete ? <details className="catalog-warning xbox-coverage-details">
      <summary>Datenabdeckung unvollständig · {coverage.observed} von {coverage.expected ?? '?'} Quellkarten erfasst</summary>
      <p>Die Quelle konnte nicht vollständig eingelesen werden. Fehlende Einträge werden weder geschätzt noch aus anderen Abos übernommen. <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Quelle prüfen ↗</a></p>
    </details> : null}

    {!captureMissing && (tab === 'deals'
      ? <p className="catalog-note">Preise und Rabatte sind Beobachtungen aus dem offiziellen Katalog zum genannten Quellenstand, keine Zusicherung. Maßgeblich ist der Microsoft Store.</p>
      : <p className="catalog-note">Abo-Zugehörigkeit gilt für die angezeigte Plattform und das genannte Abo. Eine Aufnahme in ein Abo ist kein Besitz und kann enden. Game Pass für PC und Cloud werden hier nicht als Konsolenzugang ausgewiesen.</p>)}

    {!captureMissing ? <><div className="catalog-filter-head">
      <label className="catalog-search"><span className="sr-only">Spiele suchen</span>
        <input type="search" placeholder="Spiel suchen …" value={query} onChange={(event) => update(setQuery)(event.target.value)} /></label>
      <button className="catalog-filter-toggle" onClick={() => setHideFilters(!hideFilters)} aria-expanded={!hideFilters}>{hideFilters ? 'Filter anzeigen' : 'Filter'}</button>
    </div>
    {!hideFilters ? <div className="catalog-filters">
      <span className="xbox-platform-caption">Plattform: Xbox Series X|S</span>
      {genres.length ? <label>Genre<select value={genre} onChange={(event) => update(setGenre)(event.target.value)}>
        <option value="all">Alle Genres</option>
        {genres.map((value) => <option key={value} value={value}>{value}</option>)}
      </select></label> : null}
      <label>Sortieren<select value={sort} onChange={(event) => update(setSort)(event.target.value)}>
        {tab === 'deals' ? <><option value="relevanz">Höchster Rabatt</option><option value="rabatt-asc">Niedrigster Rabatt</option></> : null}
        <option value="titel">Titel A–Z</option>
        <option value="titel-desc">Titel Z–A</option>
        {hasPrices ? <><option value="preis">Günstigster Preis</option><option value="preis-desc">Höchster Preis</option></> : null}
        <option value="cover-first">Mit Bild zuerst</option>
      </select></label>
      <label className="catalog-check"><input type="checkbox" checked={onlyWithArt} onChange={(event) => update(setOnlyWithArt)(event.target.checked)} /> Nur mit Bild</label>
    </div> : null}</> : null}

    {!captureMissing ? <><div className="catalog-results-head">
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
    </nav> : null}</> : null}

    <footer className="catalog-footer">
      Private Übersicht · Beta · Keine Kauf- oder Abo-Funktion · Verfügbarkeit, Preis und Berechtigung im Microsoft Store prüfen.
      {!genres.length && captured ? <><br />Genreangaben sind für diesen Bereich nicht durchgehend verifiziert.</> : null}
      <br />Quelle: <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">{snapshot.sourceUrl}</a>, Ziel Xbox Series X|S.
    </footer>
  </div>;
}
