import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import WatchlistClient from './WatchlistClient';

export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const jar = await cookies();
  const expected = sessionToken();
  const actual = jar.get(COOKIE_NAME)?.value;
  if (!expected || !safeEqual(actual, expected)) redirect('/');

  return (
    <main className="watchlist-shell">
      <section className="watchlist-page">
        <header className="watchlist-head">
          <div>
            <span>PLAYSTATION-RADAR · PERSÖNLICH</span>
            <h1>Watchlist</h1>
            <p>Gemerkte Spiele und Deals. Preise stammen aus dem täglich gespeicherten Radar-Verlauf.</p>
          </div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <a href="/preise">€ Preisradar</a>
            <a href="/radar">← Zur Ausgabe</a>
          </div>
        </header>
        <WatchlistClient />
      </section>
    </main>
  );
}
