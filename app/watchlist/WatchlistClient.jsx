'use client';

import { useEffect, useMemo, useState } from 'react';
import radar from '../../data/radar.json';
import priceHistory from '../../data/price-history.json';

const WATCHLIST_KEY = 'psradar_watchlist_v1';
const WATCHLIST_EVENT = 'psradar-watchlist';

function readItems() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map((item) => typeof item === 'string' ? { title: item } : item).filter((item) => item?.title) : [];
  } catch {
    return [];
  }
}

function euro(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function historyFor(title) {
  return priceHistory.games?.[title]?.points || [];
}

function signalFor(title) {
  return priceHistory.games?.[title]?.signal || null;
}

function shortDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.` : value;
}

function enrichedItem(saved) {
  const info = radar.gameDetails?.[saved.title] || {};
  const deal = (radar.deals || []).find((item) => item.title === saved.title);
  const points = historyFor(saved.title);
  const prices = points.map((point) => point.price).filter(Number.isFinite);
  const lastPoint = points.at(-1) || null;
  const signal = signalFor(saved.title);
  const current = deal?.price || null;
  const low = prices.length ? Math.min(...prices) : null;
  const image = deal?.image || info.gallery?.[0] || saved.image || null;
  const storeUrl = radar.resolvedSources?.storeDeals?.[saved.title] || info.storeUrl || priceHistory.games?.[saved.title]?.storeUrl || saved.storeUrl || null;

  return {
    ...saved,
    image,
    current,
    low,
    points: points.length,
    lastObserved: lastPoint?.price ?? null,
    lastObservedDate: lastPoint?.date || null,
    genre: info.genre || null,
    platform: deal?.platform || info.platform || saved.platform || null,
    psPlusStatus: info.psPlusStatus || null,
    discount: deal?.discount || null,
    activeDeal: Boolean(deal),
    storeUrl,
    signal,
  };
}

function signalRank(item) {
  return { buy: 0, watch: 1, wait: 2 }[item.signal?.code] ?? 3;
}

export default function WatchlistClient() {
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    const sync = () => setSaved(readItems());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(WATCHLIST_EVENT, sync);
    };
  }, []);

  const items = useMemo(() => saved.map(enrichedItem).sort((a, b) => signalRank(a) - signalRank(b) || Number(b.activeDeal) - Number(a.activeDeal)), [saved]);

  function remove(title) {
    const next = saved.filter((item) => item.title !== title);
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
    setSaved(next);
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
  }

  if (!items.length) {
    return (
      <div className="watchlist-empty">
        <span>☆</span>
        <h2>Noch nichts gemerkt</h2>
        <p>Öffne im Radar eine Spiel- oder Deal-Kachel und tippe im Detail-Sheet auf „Watchlist“.</p>
        <a href="/radar">Zum Radar →</a>
      </div>
    );
  }

  return (
    <div className="watchlist-grid">
      {items.map((item) => (
        <article className="watchlist-card" key={item.title}>
          <div className="watchlist-card-art" style={item.image ? { backgroundImage: `url("${item.image}")` } : undefined}>
            <div className="watchlist-card-top">
              <span className={item.signal ? `signal-${item.signal.code}` : ''}>{item.signal?.label || (item.activeDeal ? 'AKTIVER DEAL' : 'BEOBACHTET')}</span>
              {item.discount ? <b>{item.discount}</b> : null}
            </div>
            <div className="watchlist-card-copy">
              <h2>{item.title}</h2>
              <div className="watchlist-card-meta">
                {item.platform ? <span>{item.platform}</span> : null}
                {item.genre ? <span>{item.genre}</span> : null}
                {item.psPlusStatus ? <span>{item.psPlusStatus}</span> : null}
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
              <strong>{item.current || (item.lastObserved !== null ? euro(item.lastObserved) : '—')}</strong>
              {item.low !== null ? (
                <span>
                  Radar-Tief {euro(item.low)} · {item.points} {item.points === 1 ? 'Punkt' : 'Punkte'}
                  {!item.activeDeal && item.lastObservedDate ? ` · ${shortDate(item.lastObservedDate)}` : ''}
                </span>
              ) : <span>Noch kein Preisverlauf</span>}
            </div>
            <div className="watchlist-card-actions">
              {item.storeUrl ? <a href={item.storeUrl} target="_blank" rel="noreferrer">Store ↗</a> : null}
              <button type="button" onClick={() => remove(item.title)}>Entfernen</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
