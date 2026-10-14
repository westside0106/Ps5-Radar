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
  const [imageFailed,setImageFailed]=useState(false);
  const platforms = game.platforms?.length ? game.platforms.join(' · ') : null;
  const membership = serviceNames[service] || 'PlayStation Plus';
  const rows = [
    { label: 'Mitgliedschaft', value: membership },
    { label: 'Plattform', value: platforms },
    { label: 'Genre', value: game.genre || game.genres?.join(' · ') },
    { label: 'Spielmodus', value: game.modes?.join(' · ') },
    { label: 'Perspektive', value: game.perspective },
    { label: 'Spielzeit', value: Number.isFinite(game.playtimeHours) ? `${game.playtimeHours} Stunden` : null },
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
    image: imageFailed ? null : game.image || null, gallery: game.image && !imageFailed ? [game.image] : [],
    summary: game.description || 'Spiel aus dem offiziellen PlayStation-Plus-Katalog. Weitere Details findest du im PlayStation Store.',
    rows, links,
  };
  return <DetailTile detail={detail} className="catalog-tile">
    <article className="catalog-card">
      <div className="catalog-art">
        {game.image && !imageFailed ? <img src={game.image} alt="" loading="lazy" decoding="async" onError={()=>setImageFailed(true)} /> : <span className="catalog-no-art">PS<br/><small>{imageFailed?'Cover nicht erreichbar':'Cover nicht verifiziert'}</small></span>}
      </div>
      <div className="catalog-card-copy">
        <h3>{game.title}</h3>
        {platforms ? <p>{platforms}</p> : null}
        {game.genres?.length ? <p className="catalog-card-genres">{game.genres.slice(0,2).join(' · ')}</p> : null}
        {game.modes?.length ? <p className="catalog-card-genres">{game.modes.join(' · ')}{game.perspective ? ` · ${game.perspective}` : ''}</p> : null}
        {game.description ? <p className="catalog-card-desc">{game.description}</p> : null}
        {game.releaseDate ? <span className="catalog-card-release">Release {dateLabel(game.releaseDate)}</span> : null}
        {game.leavingAt ? <span className="catalog-expiry">Verlässt am {dateLabel(game.leavingAt)}</span> : null}
        <span className="catalog-card-more">Details ansehen ↗</span>
      </div>
    </article>
  </DetailTile>;
}

export default function CatalogClient({ snapshot }) {
  const [service, setService] = useState('extra');
  useEffect(() => {
    const syncServiceFromUrl = () => {
      const value = new URLSearchParams(window.location.search).get('tab');
      if (!CATALOG_TABS.some(tab => tab.id === value)) return;
      setService(value);
      setPage(1);
      setGenre('all');setMode('all');setPerspective('all');setPlaytime('all');
      setPlatform('all');
      setSort('release-new');
      setOnlyVerifiedArt(false);
    };
    syncServiceFromUrl();
    window.addEventListener('popstate', syncServiceFromUrl);
    return () => window.removeEventListener('popstate', syncServiceFromUrl);
  }, []);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [platform, setPlatform] = useState('all');
  const [genre, setGenre] = useState('all');
  const [mode, setMode] = useState('all');
  const [perspective, setPerspective] = useState('all');
  const [playtime, setPlaytime] = useState('all');
  const [sort, setSort] = useState('release-new');
  const [page, setPage] = useState(1);
  const [onlyVerifiedArt, setOnlyVerifiedArt] = useState(false);
  const [hideFilters, setHideFilters] = useState(false);
  const status = snapshot.sections[service] || {};
  const games = snapshot.games || [];
  const serviceGames = useMemo(() => games.filter(game => game.services?.includes(service)), [games, service]);
  const hasPlatforms = useMemo(() => serviceGames.some(game => game.platforms?.length), [serviceGames]);
  const genres = useMemo(() => [...new Set(serviceGames.flatMap(g => g.genres || []))].sort((a,b) => a.localeCompare(b,'de')), [serviceGames]);
  const modes = useMemo(() => [...new Set(serviceGames.flatMap(g=>g.modes||[]))].sort(), [serviceGames]);
  const perspectives = useMemo(() => [...new Set(serviceGames.map(g=>g.perspective).filter(Boolean))].sort(), [serviceGames]);
  const playtimeCount = useMemo(() => serviceGames.filter(g=>Number.isFinite(g.playtimeHours)).length, [serviceGames]);
  const recentChanges = useMemo(() => (snapshot.changes || []).filter(change => change.service === service).slice(0,12), [snapshot.changes,service]);
  const recentAdds = recentChanges.filter(change => change.kind === 'added');
  const recentRemovals = recentChanges.filter(change => change.kind === 'removed');
  const hasAddedDates = useMemo(() => serviceGames.some(game => Boolean(game.addedAt)), [serviceGames]);
  const hasLeavingDates = useMemo(() => serviceGames.some(game => Boolean(game.leavingAt)), [serviceGames]);
  const releaseDateCount = useMemo(() => serviceGames.filter(game => Boolean(game.releaseDate)).length, [serviceGames]);
  const filtered = useMemo(() => catalogFilter(games, { service, query: deferredQuery, platform, genre, mode, perspective, playtime, sort }).filter(g => !onlyVerifiedArt || Boolean(g.image)), [games,service,deferredQuery,platform,genre,mode,perspective,playtime,sort,onlyVerifiedArt]);
  const pages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const visible = filtered.slice((Math.min(page,pages)-1)*PAGE_SIZE,Math.min(page,pages)*PAGE_SIZE);
  const update = setter => value => { setter(value); setPage(1); };
  const selectService = value => {
    if (value === service) return;
    setService(value);setPage(1);setGenre('all');setMode('all');setPerspective('all');setPlaytime('all');setPlatform('all');setSort('release-new');setOnlyVerifiedArt(false);
    window.history.pushState(null,'',`/ps-plus?tab=${value}`);
  };
  const hasActiveFilters = Boolean(query.trim()) || platform !== 'all' || genre !== 'all' || mode !== 'all' || perspective !== 'all' || playtime !== 'all' || sort !== 'release-new' || onlyVerifiedArt;
  const resetFilters = () => { setQuery(''); setPlatform('all'); setGenre('all');setMode('all');setPerspective('all');setPlaytime('all'); setSort('release-new'); setOnlyVerifiedArt(false); setPage(1); };
  const goToPage = nextPage => {
    setPage(nextPage);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('catalog-results')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  };
  const sourceDate = dateLabel(snapshot.checkedAt);
  const total = games.length;
  const duplicateCards = status.complete && Number.isFinite(status.expected) ? Math.max(0, status.expected - (status.count ?? 0)) : 0;
  return <div className="catalog-app">
    <header className="catalog-header">
      <nav className="catalog-back"><a href="/radar">← Magazin</a><a href="/radar" className="is-active" aria-current="page">PlayStation</a><a href="/xbox">Xbox <b>BETA</b></a><a href="/preise">Preisradar</a><a href="/mein-playstation">Mein PlayStation</a></nav>
      <div className="catalog-heading"><div><span className="catalog-eyebrow">PLAYSTATION-RADAR · DEUTSCHLAND</span><h1>Dein PS+ Spielekatalog</h1><p>Alle verlässlich erfassten Katalogbereiche durchsuchen, filtern und direkt im PlayStation Store öffnen.</p></div><div className="catalog-count"><strong>{total.toLocaleString('de-DE')}</strong><span>eindeutige erfasste Titel</span></div></div>
    </header>
    <nav className="catalog-tabs" aria-label="PS-Plus-Bereiche">{CATALOG_TABS.map(tab => {
      const count = snapshot.sections?.[tab.id]?.count;
      return <button key={tab.id} type="button" aria-label={tab.label} className={service===tab.id?'active':''} aria-current={service===tab.id?'page':undefined} onClick={()=>selectService(tab.id)}><span>{tab.label}</span>{Number.isFinite(count) ? <small className="catalog-tab-count" aria-hidden="true">{count.toLocaleString('de-DE')}</small> : null}</button>;
    })}</nav>
    <section className="catalog-status" aria-live="polite"><div><strong>{serviceNames[service] || 'Katalog'}</strong><span>{status.count ?? 0} eindeutige Einträge{status.complete && Number.isFinite(status.expected) ? ` aus ${status.expected} Quellkarten` : ''}{duplicateCards ? ` · ${duplicateCards} Dubletten zusammengeführt` : ''}{status.complete?' · Quelle vollständig geprüft':' · Abdeckung nicht vollständig bestätigt'}</span></div><span className="catalog-date">{status.stale?'Stand veraltet · ':''}{sourceDate ? `Quellenstand ${sourceDate}`:'Noch kein gültiger Snapshot'}</span></section>
    {!status.complete || status.stale ? <div className="catalog-warning" role="status">{status.stale ? <>Der letzte vollständige Quellencheck liegt mehr als 48 Stunden zurück. Die zuletzt vollständig bestätigten Einträge bleiben sichtbar, können aber inzwischen geändert worden sein. </> : <>Eine vollständige Abdeckung dieses Bereichs ist derzeit nicht bestätigt. Die angezeigten Einträge sind keine Garantie für aktuelle Verfügbarkeit. </>}<a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Offiziellen Katalog prüfen ↗</a></div> : null}
    {service==='essential' ? <p className="catalog-note">Monatliche Spiele müssen während ihres Beanspruchungszeitraums zur Bibliothek hinzugefügt werden. Sie bleiben mit aktivem PS-Plus-Abonnement spielbar.</p> : null}
    {service==='extra' ? <p className="catalog-note">Extra-Spiele sind nur während ihrer Katalogzugehörigkeit spielbar. Ein früheres Hinzufügen zur Bibliothek verlängert den Zugriff nicht. Premium enthält ebenfalls den Extra-Spielekatalog.</p> : null}
    {service==='premium' ? <p className="catalog-note">Diese Ansicht zeigt den Klassikerkatalog. Mit Premium erhältst du zusätzlich Zugriff auf den Extra-Spielekatalog.</p> : null}
    {recentChanges.length ? <section className="catalog-change-feed" aria-label="Änderungen im Spielekatalog">
      <h2>Katalogänderungen <small>{recentAdds.length} hinzugefügt · {recentRemovals.length} entfernt (letzte erfasste Änderungen)</small></h2>
      <div className="catalog-change-list">{recentChanges.map((change,index)=><a key={change.id+change.kind+change.date+index} href={change.storeUrl} target="_blank" rel="noopener noreferrer"><span className={change.kind==='added'?'catalog-change-added':'catalog-change-removed'}>{change.kind==='added'?'Neu im Abo':'Entfernt'}</span><strong>{change.title}</strong><small>{dateLabel(change.date)}</small></a>)}</div>
    </section> : null}
    <section className="catalog-discovery" aria-label="Spiele entdecken">
      <div><strong>Was soll ich spielen?</strong><span>Direkt stöbern · PS5, Genre und neue Veröffentlichungen</span></div>
      <div className="catalog-discovery-actions">
        <button type="button" onClick={()=>{setPlatform('PS5');setGenre('all');setSort('release-new');setPage(1);}}>PS5 · Neueste zuerst</button>
        {['Action','Adventure','Rennspiele','Rollenspiele','Simulation'].filter(g=>genres.includes(g)).map(g=><button key={g} type="button" onClick={()=>{setGenre(g);setPage(1);}}>{g}</button>)}
        <button type="button" onClick={resetFilters}>Alle Spiele</button>
      </div>
    </section>
    <div className="catalog-filter-head"><label className="catalog-search"><span className="sr-only">Spiele suchen</span><input type="search" placeholder="Spiel suchen …" value={query} onChange={e=>update(setQuery)(e.target.value)} /></label>{hasActiveFilters ? <button className="catalog-reset" type="button" onClick={resetFilters}>Zurücksetzen</button> : null}<button className="catalog-filter-toggle" type="button" onClick={()=>setHideFilters(!hideFilters)} aria-expanded={!hideFilters}>{hideFilters?'Filter anzeigen':'Filter'}</button></div>
    {!hideFilters ? <div className="catalog-filters">{hasPlatforms ? <label>Plattform<select value={platform} onChange={e=>update(setPlatform)(e.target.value)}><option value="all">Alle Plattformen</option><option value="PS5">PS5</option><option value="PS4">PS4</option></select></label> : null}{genres.length ? <label>Genre<select value={genre} onChange={e=>update(setGenre)(e.target.value)}><option value="all">Alle Genres</option>{genres.map(g=><option key={g} value={g}>{g}</option>)}</select></label> : null}{modes.length ? <label>Spielmodus<select value={mode} onChange={e=>update(setMode)(e.target.value)}><option value="all">Alle Spielmodi</option>{modes.map(v=><option key={v} value={v}>{v}</option>)}</select></label> : null}{perspectives.length ? <label>Perspektive<select value={perspective} onChange={e=>update(setPerspective)(e.target.value)}><option value="all">Alle Perspektiven</option>{perspectives.map(v=><option key={v} value={v}>{v}</option>)}</select></label> : null}{playtimeCount ? <label>Spielzeit<select value={playtime} onChange={e=>update(setPlaytime)(e.target.value)}><option value="all">Alle Spielzeiten</option><option value="0-10">Unter 10 Stunden</option><option value="10-30">10–29 Stunden</option><option value="30-60">30–59 Stunden</option><option value="60-">60+ Stunden</option></select></label> : null}<div className="catalog-sort" role="group" aria-label="Spiele sortieren">
  <span className="catalog-sort-heading">Sortieren</span>
  <div className="catalog-sort-chips">
    <button type="button" className={sort.startsWith('title') ? 'active' : ''} aria-pressed={sort.startsWith('title')} onClick={()=>update(setSort)(sort==='title'?'title-desc':'title')}>Titel {sort==='title-desc'?'Z–A':'A–Z'} <span aria-hidden="true">↕</span></button>
    {hasAddedDates ? <button type="button" className={sort==='recent'?'active':''} aria-pressed={sort==='recent'} onClick={()=>update(setSort)('recent')}>Neu hinzugefügt</button> : null}
    {<button type="button" className={sort.startsWith('release-')?'active':''} aria-pressed={sort.startsWith('release-')} onClick={()=>update(setSort)(sort==='release-new'?'release-old':'release-new')}>Veröffentlichung {sort==='release-old'?'Alt → Neu':'Neu → Alt'}</button>}
    {hasLeavingDates ? <button type="button" className={sort==='leaving'?'active':''} aria-pressed={sort==='leaving'} onClick={()=>update(setSort)('leaving')}>Verlässt zuerst</button> : null}
    {genres.length ? <button type="button" className={sort==='genre'||sort==='genre-desc'?'active':''} aria-pressed={sort==='genre'||sort==='genre-desc'} onClick={()=>update(setSort)(sort==='genre'?'genre-desc':'genre')}>Genre {sort==='genre-desc'?'Z–A':'A–Z'} <span aria-hidden="true">↕</span></button> : null}
    {hasPlatforms ? <button type="button" className={sort==='ps5-first'||sort==='ps4-first'?'active':''} aria-pressed={sort==='ps5-first'||sort==='ps4-first'} onClick={()=>update(setSort)(sort==='ps5-first'?'ps4-first':'ps5-first')}>{sort==='ps4-first'?'PS4 vor PS5':'PS5 vor PS4'} <span aria-hidden="true">⇄</span></button> : null}
    <button type="button" className={sort==='cover-first'||sort==='cover-last'?'active':''} aria-pressed={sort==='cover-first'||sort==='cover-last'} onClick={()=>update(setSort)(sort==='cover-first'?'cover-last':'cover-first')}>{sort==='cover-last'?'Ohne Cover zuerst':'Mit Cover zuerst'}</button>
  </div>
</div><label className="catalog-check"><input type="checkbox" checked={onlyVerifiedArt} onChange={e=>update(setOnlyVerifiedArt)(e.target.checked)}/> Nur mit Cover</label></div> : null}
    {sort.startsWith('release-') ? <p className="catalog-date-notice" role="status">Veröffentlichung {sort==='release-new'?'Neu → Alt':'Alt → Neu'} · {releaseDateCount} von {serviceGames.length} Spielen mit bestätigtem Datum. Spiele ohne Datum stehen am Ende. Die Datenquelle liefert noch keine vollständigen Veröffentlichungsdaten; fehlende Angaben werden nicht geschätzt.</p> : null}
    <div id="catalog-results" className="catalog-results-head" aria-live="polite"><strong>{filtered.length.toLocaleString('de-DE')} von {serviceGames.length.toLocaleString('de-DE')} {serviceGames.length===1?'Spiel':'Spielen'}</strong><span>{hasActiveFilters?'Filter aktiv · ':''}{filtered.length?`${(Math.min(page,pages)-1)*PAGE_SIZE+1}–${Math.min(Math.min(page,pages)*PAGE_SIZE,filtered.length)}`:'Keine Treffer'}</span></div>
    {visible.length ? <div className="catalog-grid">{visible.map(game=><CatalogCard key={game.id} game={game} service={service}/>)}</div> : <div className="catalog-empty"><h2>Keine passenden Einträge</h2><p>{status.complete?'Versuche andere Suchbegriffe oder Filter.':'Für diesen Katalogbereich liegt aktuell keine vollständig bestätigte Liste vor.'}</p>{hasActiveFilters ? <button className="catalog-reset catalog-empty-reset" type="button" onClick={resetFilters}>Alle Filter zurücksetzen</button> : <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Offiziellen Spielefinder öffnen ↗</a>}</div>}
    {pages>1 ? <nav className="catalog-pagination" aria-label="Ergebnisseiten"><button disabled={page<=1} onClick={()=>goToPage(page-1)}>← Zurück</button><span>Seite {Math.min(page,pages)} von {pages}</span><button disabled={page>=pages} onClick={()=>goToPage(page+1)}>Weiter →</button></nav> : null}
    <footer className="catalog-footer">Private Spieleübersicht · Keine Kauf- oder Abo-Funktion · Verfügbarkeit und Berechtigung im offiziellen Store prüfen.{!hasPlatforms || !genres.length ? <><br/>Plattform- und Genrefilter erscheinen nur, wenn die offizielle Katalogquelle diese Angaben belastbar liefert.</> : null}</footer>
  </div>;
}
