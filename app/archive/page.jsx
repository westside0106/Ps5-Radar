import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import archive from '../../data/archive/index.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';

export const dynamic = 'force-dynamic';

export default async function ArchivePage(){
  const jar=await cookies();
  const expected=sessionToken();
  const actual=jar.get(COOKIE_NAME)?.value;
  if(!expected||!safeEqual(actual,expected)) redirect('/');
  return <main className="archive-shell"><section className="archive-page"><header className="archive-head"><div><span>PLAYSTATION-RADAR</span><h1>Ausgaben-Archiv</h1><p>Alle bisherigen täglichen Radar-Ausgaben.</p></div><a href="/radar">Aktuelle Ausgabe</a></header><div className="archive-grid">{archive.map(issue=><a className="archive-card" href={`/archive/${issue.id}`} key={issue.id}><div className="archive-number">#{issue.id}</div><div><small>{issue.date}</small><h2>{issue.edition}</h2><p>{issue.headline}</p><strong>{issue.lead}</strong></div><span className="archive-open">Öffnen →</span></a>)}</div></section></main>
}
