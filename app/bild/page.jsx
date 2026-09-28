import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import radar from '../../data/radar.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';

export const dynamic = 'force-dynamic';

export default async function ImageViewerPage(){
  const jar = await cookies();
  const expected = sessionToken();
  const actual = jar.get(COOKIE_NAME)?.value;
  if(!expected || !safeEqual(actual, expected)) redirect('/');

  return <main className="image-viewer-shell">
    <section className="image-viewer-page">
      <header className="image-viewer-head">
        <div><small>PLAYSTATION-RADAR · BILD</small><strong>{radar.date} · {radar.edition}</strong></div>
        <nav className="image-viewer-actions" aria-label="Bildnavigation">
          <a href="/radar">← Magazin</a>
          <a href="/daily/latest.png" target="_blank" rel="noreferrer">Original-PNG ↗</a>
        </nav>
      </header>
      <figure className="image-viewer-frame">
        <img src="/daily/latest.png" alt={`PlayStation-Radar ${radar.edition} vom ${radar.date}`} decoding="async" />
      </figure>
      <p className="image-viewer-note">Responsive Ansicht des unveränderten Pipeline-PNGs. „Original-PNG“ öffnet weiterhin die Rohdatei.</p>
    </section>
  </main>;
}
