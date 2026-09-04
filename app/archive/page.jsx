import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import archive from '../../data/archive/index.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';

export const dynamic='force-dynamic';

export default async function ArchivePage(){
  const jar=await cookies();const expected=sessionToken();const actual=jar.get(COOKIE_NAME)?.value;
  if(!expected||!safeEqual(actual,expected))redirect('/');
  const issues=await Promise.all(archive.map(async issue=>{try{const data=(await import(`../../data/archive/${issue.file}`)).default;return{...issue,image:issue.image||data.leadImage}}catch{return issue}}));
  return <main className="archive-shell"><section className="archive-page"><header className="archive-head"><div><span>PLAYSTATION-RADAR · MAGAZIN</span><h1>Ausgaben-Archiv</h1><p>Jede Daily-Ausgabe bleibt mit ihrem damaligen Stand erhalten.</p></div><a href="/radar">Aktuelle Ausgabe →</a></header><div className="archive-grid archive-cover-grid">{issues.map(issue=><a className="archive-cover-card" href={`/archive/${issue.id}`} key={issue.id}><div className="archive-cover-image" style={{backgroundImage:`linear-gradient(180deg,rgba(3,8,18,.05),rgba(3,8,18,.92)),url("${issue.image||''}")`}}><div className="archive-cover-edition">{issue.edition}</div><div className="archive-cover-copy"><small>{issue.date}</small><h2>{issue.lead}</h2><p>{issue.headline}</p></div></div><div className="archive-cover-foot"><span>PLAYSTATION-RADAR</span><b>Ausgabe öffnen →</b></div></a>)}</div></section></main>
}
