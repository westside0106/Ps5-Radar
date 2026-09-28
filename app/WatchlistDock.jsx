'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import priceHistory from '../data/price-history.json';

const WATCHLIST_KEY = 'psradar_watchlist_v1';
const WATCHLIST_EVENT = 'psradar-watchlist';

function watchlistStats() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) || '[]');
    const items = Array.isArray(parsed) ? parsed.map((item) => typeof item === 'string' ? { title: item } : item).filter((item) => item?.title) : [];
    const buy = items.filter((item) => priceHistory.games?.[item.title]?.signal?.code === 'buy').length;
    const watch = items.filter((item) => priceHistory.games?.[item.title]?.signal?.code === 'watch').length;
    return { count: items.length, buy, watch };
  } catch {
    return { count: 0, buy: 0, watch: 0 };
  }
}

export default function WatchlistDock() {
  const pathname = usePathname();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const sync = () => setStats(watchlistStats());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(WATCHLIST_EVENT, sync);
    };
  }, []);

  const browseSurface = pathname?.startsWith('/ps-plus') || pathname?.startsWith('/xbox') || pathname?.startsWith('/preise') || pathname?.startsWith('/watchlist') || pathname?.startsWith('/bild');
  if (pathname === '/' || browseSurface || stats === null) return null;

  const signalText = stats.buy ? `${stats.buy} Kaufsignal${stats.buy === 1 ? '' : 'e'}` : stats.watch ? `${stats.watch} beobachten` : null;

  return (
    <a className={`watchlist-dock ${stats.buy ? 'has-buy-signal' : ''}`} href="/watchlist" aria-label={`Watchlist mit ${stats.count} Einträgen${signalText ? `, ${signalText}` : ''}`}>
      <span aria-hidden="true">★</span>
      <b>{signalText || 'Watchlist'}</b>
      <em>{stats.count}</em>
    </a>
  );
}
