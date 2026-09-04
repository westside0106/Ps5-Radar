import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import archive from '../../../data/archive/index.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../../auth';

export const dynamic='force-dynamic';

export default async function IssuePage({params}){
  const jar=await cookies(); const expected=sessionToken(); const actual=jar.get(COOKIE_NAME)?.value;
  if(!expected||!safeEqual(actual,expected)) redirect('/');
  const {id}=await params; const issue=archive.find(x=>x.id===id); if(!issue) notFound();
  const data=(await import(`../../../data/archive/${issue.file}`)).default;
  return <main className="archive-shell"><section className="archive-page"><header className="archive-head"><div><span>PLAYSTATION-RADAR · ARCHIV</span><h1>{data.edition}</h1><p>{data.date} · {data.newHeadline}</p></div><div className="archive-actions"><a href="/archive">← Archiv</a><a href="/radar">Aktuell</a></div></header><article className="issue-view"><div className="issue-hero" style={{backgroundImage:`linear-gradient(180deg,rgba(2,6,14,.05),rgba(2,6,14,.9)),url("${data.leadImage}")`}}><small>TOP-NEWS</small><h2>{data.leadTitle}</h2><p>{data.leadMeta}</p><strong>{data.leadPrice}</strong></div><section><h3>PlayStation Plus</h3><div className="issue-covers">{data.plusGames.map(g=><div key={g.title}><div style={{backgroundImage:`url("${g.image}")`}}/><span>{g.title}</span></div>)}</div></section><section><h3>Store-Deals</h3><div className="issue-deals">{data.deals.map(d=><div key={d.title}><b>{d.discount}</b><strong>{d.title}</strong><span>{d.price}</span></div>)}</div></section><section><h3>Kommende Releases</h3>{data.releases.map(r=><p key={`${r.date}${r.title}`}><b>{r.date}</b> · {r.title}</p>)}</section></article></section></main>
}
