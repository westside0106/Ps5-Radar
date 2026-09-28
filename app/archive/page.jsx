import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import archive from '../../data/archive/index.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import ArchiveClient from './ArchiveClient';

export const dynamic='force-dynamic';

export default async function ArchivePage(){
  const jar=await cookies();const expected=sessionToken();const actual=jar.get(COOKIE_NAME)?.value;
  if(!expected||!safeEqual(actual,expected))redirect('/');
  const resolved=await Promise.all(archive.map(async issue=>{try{const data=(await import(`../../data/archive/${issue.file}`)).default;return{...issue,image:issue.image||data.leadImage,lead:issue.lead||data.leadTitle,headline:issue.headline||data.newHeadline}}catch{return issue}}));
  const issues=resolved.map((issue,index)=>{const previous=resolved[index+1];const repeatedLead=Boolean(previous&&issue.lead&&previous.lead&&issue.lead===previous.lead&&issue.image&&previous.image&&issue.image===previous.image);return{...issue,repeatedLead}});
  return <main className="archive-shell"><section className="archive-page"><header className="archive-head"><div><span>PLAYSTATION-RADAR · MAGAZIN</span><h1>Ausgaben-Archiv</h1><p>Jede Daily-Ausgabe bleibt mit ihrem damaligen Stand erhalten. Wiederholte Cover werden gekennzeichnet, wenn die Top-News gegenüber dem Vortag unverändert blieb.</p></div><a href="/radar">Aktuelle Ausgabe →</a></header><ArchiveClient issues={issues}/></section></main>
}
