'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const WATCHLIST_KEY = 'psradar_watchlist_v1';
const WATCHLIST_EVENT = 'psradar-watchlist';

function countItems() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export default function WatchlistDock() {
  const pathname = usePathname();
  const [count, setCount] = useState(null);

  useEffect(() => {
    const sync = () => setCount(countItems());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(WATCHLIST_EVENT, sync);
    };
  }, []);

  if (pathname === '/' || count === null) return null;

  return (
    <a className="watchlist-dock" href="/watchlist" aria-label={`Watchlist mit ${count} Einträgen`}>
      <span aria-hidden="true">★</span>
      <b>Watchlist</b>
      <em>{count}</em>
    </a>
  );
}
