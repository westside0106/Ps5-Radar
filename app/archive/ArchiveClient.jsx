'use client';

import { useMemo, useState } from 'react';

function issueNumber(issue) {
  const value = Number.parseInt(String(issue.id || '').replace(/\D/g, ''), 10);
  return Number.isFinite(value) ? value : 0;
}

export default function ArchiveClient({ issues }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const needle = query.trim().toLocaleLowerCase('de');

  const visible = useMemo(() => {
    const filtered = issues.filter((issue) => !needle || [issue.edition, issue.date, issue.lead, issue.headline]
      .filter(Boolean).join(' ').toLocaleLowerCase('de').includes(needle));
    return [...filtered].sort((a, b) => sort === 'oldest'
      ? issueNumber(a) - issueNumber(b)
      : issueNumber(b) - issueNumber(a));
  }, [issues, needle, sort]);

  return <>
    <div className="archive-tools">
      <label className="archive-search"><span className="sr-only">Archiv durchsuchen</span><input type="search" inputMode="search" placeholder="Ausgaben durchsuchen …" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="archive-sort"><span>Sortieren</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option></select></label>
      {query ? <button type="button" className="archive-reset" onClick={() => setQuery('')}>Zurücksetzen</button> : null}
    </div>
    <div className="archive-results"><strong>{visible.length} {visible.length === 1 ? 'Ausgabe' : 'Ausgaben'}</strong>{query ? <span>für „{query}“</span> : <span>vollständig gespeichert</span>}</div>
    {visible.length ? <div className="archive-grid archive-cover-grid">{visible.map((issue) => <a className="archive-cover-card" href={`/archive/${issue.id}`} key={issue.id}>
      <div className="archive-cover-image" style={{backgroundImage:`linear-gradient(180deg,rgba(3,8,18,.05),rgba(3,8,18,.92)),url("${issue.image || ''}")`}}>
        <div className="archive-cover-top"><div className="archive-cover-edition">{issue.edition}</div>{issue.repeatedLead ? <span className="archive-repeat">Top-News unverändert</span> : null}</div>
        <div className="archive-cover-copy"><small>{issue.date}</small><h2>{issue.lead}</h2><p>{issue.headline}</p></div>
      </div>
      <div className="archive-cover-foot"><span>PLAYSTATION-RADAR</span><b>Ausgabe öffnen →</b></div>
    </a>)}</div> : <div className="archive-empty"><h2>Keine Ausgabe gefunden</h2><p>Suchbegriff ändern oder zurücksetzen.</p><button type="button" onClick={() => setQuery('')}>Suche zurücksetzen</button></div>}
  </>;
}
