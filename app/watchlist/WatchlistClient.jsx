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

function enrichedItem(saved) {
  const info = radar.gameDetails?.[saved.title] || {};
  const deal = (radar.deals || []).find((item) => item.title === saved.title);
  const points = historyFor(saved.title);
  const prices = points.map((point) => point.price).filter(Number.isFinite);
  const current = deal?.price || (prices.length ? euro(prices.at(-1)) : saved.price || null);
  const low = prices.length ? Math.min(...prices) : null;
  const image = deal?.image || info.gallery?.[0] || saved.image || null;
  const storeUrl = radar.resolvedSources?.storeDeals?.[saved.title] || info.storeUrl || priceHistory.games?.[saved.title]?.storeUrl || saved.storeUrl || null;

  return {
    ...saved,
    image,
    current,
    low,
    points: points.length,
    genre: info.genre || null,
    platform: deal?.platform || info.platform || saved.platform || null,
    psPlusStatus: info.psPlusStatus || null,
    discount: deal?.discount || saved.discount || null,
    activeDeal: Boolean(deal),
    storeUrl,
  };
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

  const items = useMemo(() => saved.map(enrichedItem), [saved]);

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
              <span>{item.activeDeal ? 'AKTIVER DEAL' : 'BEOBACHTET'}</span>
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
          <div className="watchlist-card-foot">
            <div className="watchlist-price">
              <small>AKTUELL</small>
              <strong>{item.current || '—'}</strong>
              {item.low !== null ? <span>Radar-Tief {euro(item.low)} · {item.points} {item.points === 1 ? 'Punkt' : 'Punkte'}</span> : <span>Noch kein Preisverlauf</span>}
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
