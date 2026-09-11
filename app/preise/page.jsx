import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import radar from '../../data/radar.json';
import priceHistory from '../../data/price-history.json';
import { COOKIE_NAME, safeEqual, sessionToken } from '../auth';
import DetailTile from '../radar/DetailTile';

export const dynamic = 'force-dynamic';

function euro(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function shortDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value || '—';
}

function rank(signal) {
  return { buy: 0, watch: 1, wait: 2 }[signal?.code] ?? 3;
}

export default async function PriceRadarPage() {
  const jar = await cookies();
  const expected = sessionToken();
  const actual = jar.get(COOKIE_NAME)?.value;
  if (!expected || !safeEqual(actual, expected)) redirect('/');

  const items = Object.values(priceHistory.games || {}).map((game) => {
    const deal = (radar.deals || []).find((item) => item.title === game.title);
    const info = radar.gameDetails?.[game.title] || {};
    const points = game.points || [];
    const latest = points.at(-1) || null;
    const signal = game.signal || null;
    return {
      ...game,
      signal,
      latest,
      activeDeal: Boolean(deal),
      currentPrice: signal?.activeDeal ? signal.currentPrice : null,
      image: deal?.image || info.gallery?.[0] || game.image || null,
      platform: deal?.platform || info.platform || game.platform || null,
      genre: info.genre || null,
      discount: deal?.discount || (signal?.discount ? `-${signal.discount} %` : null),
      storeUrl: radar.resolvedSources?.storeDeals?.[game.title] || info.storeUrl || game.storeUrl || null,
    };
  }).sort((a, b) => rank(a.signal) - rank(b.signal) || Number(b.activeDeal) - Number(a.activeDeal) || a.title.localeCompare(b.title, 'de'));

  const counts = priceHistory.summary?.signals || { buy: 0, watch: 0, wait: 0 };

  return (
    <main className="watchlist-shell">
      <section className="watchlist-page">
        <header className="watchlist-head">
          <div>
            <span>PLAYSTATION-RADAR · PREISVERLAUF</span>
            <h1>Preisradar</h1>
            <p>
              {items.length} beobachtete Titel · {priceHistory.summary?.points || 0} Messpunkte · {counts.buy || 0} Kaufen · {counts.watch || 0} Beobachten · {counts.wait || 0} Warten. Signale beziehen sich ausschließlich auf den eigenen Radar-Verlauf, nicht auf externe Allzeit-Tiefpreise.
            </p>
            <details className="radar-help">
              <summary aria-label="Erklärung der Begriffe">Was bedeuten diese Angaben?</summary>
              <p>
                <b>Messpunkt:</b> ein Preis, den der Radar in einer Tagesausgabe tatsächlich im Store verifiziert hat – eine Messung pro Ausgabe, nicht pro Tag.
                Bisher {priceHistory.summary?.points || 0} Messpunkte aus {priceHistory.summary?.archiveIssuesScanned || 0} ausgewerteten Ausgaben.{' '}
                <b>Radar-Tief:</b> der niedrigste dieser eigenen Messwerte – kein Allzeit-Tiefpreis und kein Vergleich mit anderen Anbietern.{' '}
                <b>Zuletzt gemessen:</b> das Datum der jüngsten Messung, kein Ereignis am Spiel.{' '}
                Hier stehen nur Titel, die mindestens einmal als verifiziertes Store-Angebot im Radar waren – deshalb sind es {items.length}, nicht der ganze Katalog.{' '}
                <b>Neu messen:</b> Messpunkte entstehen beim Lauf des Radars, nicht beim Öffnen dieser Seite. Über „Messung anstoßen“ lässt sich der Lauf jederzeit von Hand starten – dort <i>Run workflow</i> wählen. Ein Lauf am selben Tag aktualisiert die bestehende Ausgabe und erzeugt keine neue.
              </p>
            </details>
          </div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <a href="/watchlist">★ Watchlist</a>
            <a href="/radar">← Zur Ausgabe</a>
            <a href="https://github.com/westside0106/Ps5-Radar/actions/workflows/daily-radar.yml" target="_blank" rel="noreferrer">↻ Messung anstoßen ↗</a>
          </div>
        </header>

        <div className="watchlist-grid">
          {items.map((item) => (
            <DetailTile key={item.title} className="watchlist-card-wrap" detail={{
              kind: 'price',
              kicker: 'PREISRADAR',
              title: item.title,
              image: item.image || null,
              gallery: item.image ? [item.image] : [],
              summary: item.signal?.reason || 'Preisverlauf aus den eigenen verifizierten Radar-Messpunkten.',
              rows: [
                { label: 'Signal', value: item.signal?.label },
                { label: item.activeDeal ? 'Aktueller Preis' : 'Zuletzt gemessen', value: euro(item.activeDeal ? item.currentPrice : item.latest?.price) },
                { label: 'Radar-Tief', value: euro(item.signal?.radarLow) },
                { label: 'Messpunkte', value: String(item.points?.length || 0) },
                { label: 'Letzte Messung', value: shortDate(item.latest?.date) },
                { label: 'Plattform', value: item.platform },
                { label: 'Sicherheit', value: item.signal?.confidence },
              ].filter((row) => row.value != null && row.value !== '' && row.value !== '—'),
              links: item.storeUrl ? [{ label: 'PlayStation Store', url: item.storeUrl }] : [],
            }}>
            <article className="watchlist-card">
              <div className={`watchlist-card-art${item.image ? '' : ' is-missing'}`} style={item.image ? { backgroundImage:`url("${item.image}")` } : undefined}>
                {item.image ? null : <span className="watchlist-card-noart">Cover nicht verifiziert</span>}
                <div className="watchlist-card-top">
                  <span className={item.signal ? `signal-${item.signal.code}` : ''}>{item.signal?.label || 'RADAR'}</span>
                  {item.discount ? <b>{item.discount}</b> : null}
                </div>
                <div className="watchlist-card-copy">
                  <h2>{item.title}</h2>
                  <div className="watchlist-card-meta">
                    {item.platform ? <span>{item.platform}</span> : null}
                    {item.genre ? <span>{item.genre}</span> : null}
                    <span>{item.points?.length || 0} {(item.points?.length || 0) === 1 ? 'Messpunkt' : 'Messpunkte'}</span>
                  </div>
                </div>
              </div>

              {item.signal ? (
                <div className={`watchlist-signal signal-${item.signal.code}`}>
                  <div>
                    <small>RADAR-SIGNAL · SICHERHEIT {String(item.signal.confidence || 'niedrig').toUpperCase()}</small>
                    <strong>{item.signal.label}</strong>
                  </div>
                  <p>{item.signal.reason}</p>
                  {item.signal.daysRemaining !== null && item.signal.daysRemaining !== undefined ? (
                    <span>{item.signal.daysRemaining === 0 ? 'Angebot endet heute' : item.signal.daysRemaining === 1 ? 'Noch 1 Tag' : `Noch ${item.signal.daysRemaining} Tage`}</span>
                  ) : null}
                </div>
              ) : null}

              <div className="watchlist-card-foot">
                <div className="watchlist-price">
                  <small>{item.activeDeal ? 'AKTUELL' : 'ZULETZT GEMESSEN'}</small>
                  <strong>{item.activeDeal ? euro(item.currentPrice) : euro(item.latest?.price)}</strong>
                  <span>Radar-Tief {euro(item.signal?.radarLow)} · zuletzt gemessen am {shortDate(item.latest?.date)}</span>
                </div>
                <div className="watchlist-card-actions">
                  {item.storeUrl ? <a href={item.storeUrl} target="_blank" rel="noreferrer">Store ↗</a> : null}
                </div>
              </div>
            </article>
            </DetailTile>
          ))}
        </div>
      </section>
    </main>
  );
}
