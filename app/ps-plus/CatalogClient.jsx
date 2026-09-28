'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import DetailTile from '../radar/DetailTile';
import { CATALOG_TABS, catalogFilter } from '../../lib/radar-catalog-view.mjs';

const PAGE_SIZE = 36;
const serviceNames = {
  essential: 'Essential', extra: 'Extra', premium: 'Premium · Klassiker', ubisoft: 'Ubisoft+ Classics'
};

function dateLabel(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function CatalogCard({ game, service }) {
  const platforms = game.platforms?.length ? game.platforms.join(' · ') : null;
  const membership = serviceNames[service] || 'PlayStation Plus';
  const rows = [
    { label: 'Mitgliedschaft', value: membership },
    { label: 'Plattform', value: platforms },
    { label: 'Genre', value: game.genre || game.genres?.join(' · ') },
    { label: 'Entwickler', value: game.developer },
    { label: 'Publisher', value: game.publisher },
    { label: 'Release', value: dateLabel(game.releaseDate) },
    { label: 'Hinzugefügt', value: dateLabel(game.addedAt) },
    { label: 'Entfernung', value: dateLabel(game.leavingAt) },
    { label: 'Beanspruchung', value: game.claimWindow },
  ].filter(row => row.value != null && row.value !== '');
  const links = [
    game.storeUrl ? { label: 'PlayStation Store', url: game.storeUrl } : null,
    game.trailerUrl ? { label: 'Trailer / Video', url: game.trailerUrl } : null,
    game.sourceUrl ? { label: 'Offizieller Spielekatalog', url: game.sourceUrl } : null,
  ].filter(Boolean);
  const detail = {
    kind: 'catalog-game', kicker: membership.toUpperCase(), title: game.title,
    image: game.image || null, gallery: game.image ? [game.image] : [],
    summary: game.description || 'Spiel aus dem offiziellen PlayStation-Plus-Katalog. Weitere Details findest du im PlayStation Store.',
    rows, links,
  };
  return <DetailTile detail={detail} className="catalog-tile">
    <article className="catalog-card">
      <div className="catalog-art">
        {game.image ? <img src={game.image} alt="" loading="lazy" decoding="async" /> : <span className="catalog-no-art">PS<br/><small>Cover nicht verifiziert</small></span>}
      </div>
      <div className="catalog-card-copy">
        <h3>{game.title}</h3>
        {platforms ? <p>{platforms}</p> : null}
        {game.leavingAt ? <span className="catalog-expiry">Verlässt am {dateLabel(game.leavingAt)}</span> : null}
        <span className="catalog-card-more">Details ansehen ↗</span>
      </div>
    </article>
  </DetailTile>;
}

export default function CatalogClient({ snapshot }) {
  const [service, setService] = useState('extra');
  useEffect(() => { const value = new URLSearchParams(window.location.search).get('tab'); if (CATALOG_TABS.some(tab => tab.id === value)) setService(value); }, []);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [platform, setPlatform] = useState('all');
  const [genre, setGenre] = useState('all');
  const [sort, setSort] = useState('title');
  const [page, setPage] = useState(1);
  const [onlyVerifiedArt, setOnlyVerifiedArt] = useState(false);
  const [hideFilters, setHideFilters] = useState(false);
  const status = snapshot.sections[service] || {};
  const games = snapshot.games || [];
  const serviceGames = useMemo(() => games.filter(game => game.services?.includes(service)), [games, service]);
  const hasPlatforms = useMemo(() => serviceGames.some(game => game.platforms?.length), [serviceGames]);
  const genres = useMemo(() => [...new Set(serviceGames.flatMap(g => g.genres || []))].sort((a,b) => a.localeCompare(b,'de')), [serviceGames]);
  const hasAddedDates = useMemo(() => serviceGames.some(game => Boolean(game.addedAt)), [serviceGames]);
  const hasLeavingDates = useMemo(() => serviceGames.some(game => Boolean(game.leavingAt)), [serviceGames]);
  const filtered = useMemo(() => catalogFilter(games, { service, query: deferredQuery, platform, genre, sort }).filter(g => !onlyVerifiedArt || Boolean(g.image)), [games,service,deferredQuery,platform,genre,sort,onlyVerifiedArt]);
  const pages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const visible = filtered.slice((Math.min(page,pages)-1)*PAGE_SIZE,Math.min(page,pages)*PAGE_SIZE);
  const update = setter => value => { setter(value); setPage(1); };
  const selectService = value => {setService(value);setPage(1);setGenre('all');setPlatform('all');setSort('title');setOnlyVerifiedArt(false);window.history.replaceState(null,'',`/ps-plus?tab=${value}`);};
  const hasActiveFilters = Boolean(query.trim()) || platform !== 'all' || genre !== 'all' || sort !== 'title' || onlyVerifiedArt;
  const resetFilters = () => { setQuery(''); setPlatform('all'); setGenre('all'); setSort('title'); setOnlyVerifiedArt(false); setPage(1); };
  const sourceDate = dateLabel(snapshot.checkedAt);
  const total = games.length;
  return <div className="catalog-app">
    <header className="catalog-header">
      <nav className="catalog-back"><a href="/radar">← Magazin</a><a href="/radar" className="is-active" aria-current="page">PlayStation</a><a href="/xbox">Xbox <b>BETA</b></a><a href="/preise">Preisradar</a></nav>
      <div className="catalog-heading"><div><span className="catalog-eyebrow">PLAYSTATION-RADAR · DEUTSCHLAND</span><h1>Dein PS+ Spielekatalog</h1><p>Alle verlässlich erfassten Katalogbereiche durchsuchen, filtern und direkt im PlayStation Store öffnen.</p></div><div className="catalog-count"><strong>{total.toLocaleString('de-DE')}</strong><span>eindeutige erfasste Titel</span></div></div>
    </header>
    <nav className="catalog-tabs" aria-label="PS-Plus-Bereiche">{CATALOG_TABS.map(tab => {
      const count = snapshot.sections?.[tab.id]?.count;
      return <button key={tab.id} type="button" aria-label={tab.label} className={service===tab.id?'active':''} aria-current={service===tab.id?'page':undefined} onClick={()=>selectService(tab.id)}><span>{tab.label}</span>{Number.isFinite(count) ? <small className="catalog-tab-count" aria-hidden="true">{count.toLocaleString('de-DE')}</small> : null}</button>;
    })}</nav>
    <section className="catalog-status" aria-live="polite"><div><strong>{serviceNames[service] || 'Katalog'}</strong><span>{status.count ?? 0} erfasste Einträge{status.complete?' · Quelle vollständig geprüft':' · Abdeckung nicht vollständig bestätigt'}</span></div><span className="catalog-date">{status.stale?'Stand veraltet · ':''}{sourceDate ? `Quellenstand ${sourceDate}`:'Noch kein gültiger Snapshot'}</span></section>
    {!status.complete || status.stale ? <div className="catalog-warning" role="status">{status.stale ? <>Der letzte vollständige Quellencheck liegt mehr als 48 Stunden zurück. Die zuletzt vollständig bestätigten Einträge bleiben sichtbar, können aber inzwischen geändert worden sein. </> : <>Eine vollständige Abdeckung dieses Bereichs ist derzeit nicht bestätigt. Die angezeigten Einträge sind keine Garantie für aktuelle Verfügbarkeit. </>}<a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Offiziellen Katalog prüfen ↗</a></div> : null}
    {service==='essential' ? <p className="catalog-note">Monatliche Spiele müssen während ihres Beanspruchungszeitraums zur Bibliothek hinzugefügt werden. Sie bleiben mit aktivem PS-Plus-Abonnement spielbar.</p> : null}
    {service==='extra' ? <p className="catalog-note">Extra-Spiele sind nur während ihrer Katalogzugehörigkeit spielbar. Ein früheres Hinzufügen zur Bibliothek verlängert den Zugriff nicht. Premium enthält ebenfalls den Extra-Spielekatalog.</p> : null}
    {service==='premium' ? <p className="catalog-note">Diese Ansicht zeigt den Klassikerkatalog. Mit Premium erhältst du zusätzlich Zugriff auf den Extra-Spielekatalog.</p> : null}
    <div className="catalog-filter-head"><label className="catalog-search"><span className="sr-only">Spiele suchen</span><input type="search" placeholder="Spiel suchen …" value={query} onChange={e=>update(setQuery)(e.target.value)} /></label>{hasActiveFilters ? <button className="catalog-reset" type="button" onClick={resetFilters}>Zurücksetzen</button> : null}<button className="catalog-filter-toggle" type="button" onClick={()=>setHideFilters(!hideFilters)} aria-expanded={!hideFilters}>{hideFilters?'Filter anzeigen':'Filter'}</button></div>
    {!hideFilters ? <div className="catalog-filters">{hasPlatforms ? <label>Plattform<select value={platform} onChange={e=>update(setPlatform)(e.target.value)}><option value="all">Alle Plattformen</option><option value="PS5">PS5</option><option value="PS4">PS4</option></select></label> : null}{genres.length ? <label>Genre<select value={genre} onChange={e=>update(setGenre)(e.target.value)}><option value="all">Alle Genres</option>{genres.map(g=><option key={g} value={g}>{g}</option>)}</select></label> : null}{hasAddedDates || hasLeavingDates ? <label>Sortieren<select value={(sort==='recent'&&!hasAddedDates)||(sort==='leaving'&&!hasLeavingDates)?'title':sort} onChange={e=>update(setSort)(e.target.value)}><option value="title">Titel A–Z</option>{hasAddedDates?<option value="recent">Zuletzt hinzugefügt</option>:null}{hasLeavingDates?<option value="leaving">Entfernungstermin</option>:null}</select></label> : null}<label className="catalog-check"><input type="checkbox" checked={onlyVerifiedArt} onChange={e=>update(setOnlyVerifiedArt)(e.target.checked)}/> Nur mit Cover</label></div> : null}
    <div className="catalog-results-head"><strong>{filtered.length.toLocaleString('de-DE')} {filtered.length===1?'Spiel':'Spiele'}</strong><span>{filtered.length?`${(Math.min(page,pages)-1)*PAGE_SIZE+1}–${Math.min(Math.min(page,pages)*PAGE_SIZE,filtered.length)}`:'Keine Treffer'}</span></div>
    {visible.length ? <div className="catalog-grid">{visible.map(game=><CatalogCard key={game.id} game={game} service={service}/>)}</div> : <div className="catalog-empty"><h2>Keine passenden Einträge</h2><p>{status.complete?'Versuche andere Suchbegriffe oder Filter.':'Für diesen Katalogbereich liegt aktuell keine vollständig bestätigte Liste vor.'}</p>{hasActiveFilters ? <button className="catalog-reset catalog-empty-reset" type="button" onClick={resetFilters}>Alle Filter zurücksetzen</button> : <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Offiziellen Spielefinder öffnen ↗</a>}</div>}
    {pages>1 ? <nav className="catalog-pagination" aria-label="Ergebnisseiten"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Zurück</button><span>Seite {Math.min(page,pages)} von {pages}</span><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Weiter →</button></nav> : null}
    <footer className="catalog-footer">Private Spieleübersicht · Keine Kauf- oder Abo-Funktion · Verfügbarkeit und Berechtigung im offiziellen Store prüfen.{!hasPlatforms || !genres.length ? <><br/>Plattform- und Genrefilter erscheinen nur, wenn die offizielle Katalogquelle diese Angaben belastbar liefert.</> : null}</footer>
  </div>;
}